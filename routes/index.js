var express = require('express');
var router = express.Router();

const COMMENTS_PER_PAGE = 10;
const MAX_NAME_LENGTH = 100;
const MAX_COMMENT_LENGTH = 500;

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatServerTimestamp(dateValue) {
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return 'Just now';
  }
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

function fetchPaginatedComments(db, requestedPage, callback) {
  db.query('SELECT COUNT(*) AS total FROM comments;', function (countErr, countRows) {
    if (countErr) {
      return callback(countErr);
    }

    const totalCount = countRows[0].total;
    const totalPages = Math.max(1, Math.ceil(totalCount / COMMENTS_PER_PAGE));
    const currentPage = Math.min(Math.max(1, requestedPage), totalPages);
    const offset = (currentPage - 1) * COMMENTS_PER_PAGE;

    const selectSql =
      'SELECT id, author_name, comment_text, created_at FROM comments ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?;';

    db.query(selectSql, [COMMENTS_PER_PAGE, offset], function (err, rows) {
      if (err) {
        return callback(err);
      }

      const comments = rows.map(function (row) {
        return {
          id: row.id,
          author_name: row.author_name,
          comment_text: row.comment_text,
          formatted_date: formatServerTimestamp(row.created_at)
        };
      });

      callback(null, {
        comments: comments,
        currentPage: currentPage,
        totalPages: totalPages,
        totalCount: totalCount
      });
    });
  });
}

/* GET home page. */
router.get('/', function (req, res) {
  res.render('index', { pageTitle: 'Welcome', activePage: 'home' });
});

/* GET menu page. */
router.get('/menu', function (req, res) {
  res.render('menu', { pageTitle: 'Menu', activePage: 'menu' });
});

/* GET about us page. */
router.get('/about', function (req, res) {
  res.render('about', { pageTitle: 'About Us', activePage: 'about' });
});

/* GET customer comments page (initial server render). */
router.get('/comments', function (req, res) {
  const page = parseInt(req.query.page, 10) || 1;

  if (!req.db) {
    return res.render('comments', {
      pageTitle: 'Customer Comments',
      activePage: 'comments',
      comments: [],
      currentPage: 1,
      totalPages: 1,
      totalCount: 0,
      loadError: 'We could not connect to our comment board right now. Please try again in a moment.'
    });
  }

  fetchPaginatedComments(req.db, page, function (err, data) {
    if (err) {
      console.error('Error loading comments:', err);
      return res.render('comments', {
        pageTitle: 'Customer Comments',
        activePage: 'comments',
        comments: [],
        currentPage: 1,
        totalPages: 1,
        totalCount: 0,
        loadError: 'We had trouble loading customer comments right now. Please refresh or try again shortly.'
      });
    }

    res.render('comments', {
      pageTitle: 'Customer Comments',
      activePage: 'comments',
      comments: data.comments,
      currentPage: data.currentPage,
      totalPages: data.totalPages,
      totalCount: data.totalCount,
      loadError: null
    });
  });
});

/* GET paginated comments JSON API. */
router.get('/api/comments', function (req, res) {
  const page = parseInt(req.query.page, 10) || 1;

  if (!req.db) {
    return res.status(503).json({
      error: 'Our comment service is temporarily unavailable. Please try again shortly.'
    });
  }

  fetchPaginatedComments(req.db, page, function (err, data) {
    if (err) {
      console.error('API error fetching comments:', err);
      return res.status(500).json({
        error: 'Unable to load comments right now. Please try again later.'
      });
    }

    res.json(data);
  });
});

/* POST new comment JSON API with server-side validation & sanitization. */
router.post('/api/comments', function (req, res) {
  if (!req.db) {
    return res.status(503).json({
      error: 'Our comment service is temporarily unavailable. Please try again shortly.'
    });
  }

  const rawName = typeof req.body.author_name === 'string' ? req.body.author_name : '';
  const rawComment = typeof req.body.comment_text === 'string' ? req.body.comment_text : '';

  const trimmedName = rawName.trim();
  const trimmedComment = rawComment.trim();

  if (!trimmedName) {
    return res.status(400).json({
      error: 'Please enter your name (it cannot be blank or spaces only).'
    });
  }

  if (!trimmedComment) {
    return res.status(400).json({
      error: 'Please write a comment before submitting (whitespace-only comments are not allowed).'
    });
  }

  if (trimmedName.length > MAX_NAME_LENGTH) {
    return res.status(400).json({
      error: 'Name must be ' + MAX_NAME_LENGTH + ' characters or fewer.'
    });
  }

  if (trimmedComment.length > MAX_COMMENT_LENGTH) {
    return res.status(400).json({
      error:
        'Your comment is ' +
        trimmedComment.length +
        ' characters long. Please keep it under ' +
        MAX_COMMENT_LENGTH +
        ' characters.'
    });
  }

  const sanitizedName = escapeHtml(trimmedName);
  const sanitizedComment = escapeHtml(trimmedComment);

  const insertSql = 'INSERT INTO comments (author_name, comment_text) VALUES (?, ?);';

  req.db.query(insertSql, [sanitizedName, sanitizedComment], function (insertErr) {
    if (insertErr) {
      console.error('Error saving comment:', insertErr);
      return res.status(500).json({
        error: 'We could not save your comment right now. Please try again in a moment.'
      });
    }

    fetchPaginatedComments(req.db, 1, function (fetchErr, data) {
      if (fetchErr) {
        console.error('Error reloading comments after insert:', fetchErr);
        return res.status(201).json({
          message: 'Comment posted! Please refresh the page to see the updated list.'
        });
      }

      res.status(201).json({
        message: 'Thank you! Your comment has been posted.',
        comments: data.comments,
        currentPage: data.currentPage,
        totalPages: data.totalPages,
        totalCount: data.totalCount
      });
    });
  });
});

module.exports = router;
