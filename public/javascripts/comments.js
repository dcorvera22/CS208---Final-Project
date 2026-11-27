document.addEventListener('DOMContentLoaded', function () {
  const form = document.getElementById('comment-form');
  const nameInput = document.getElementById('author_name');
  const commentInput = document.getElementById('comment_text');
  const charCount = document.getElementById('char-count');
  const submitBtn = document.getElementById('submit-comment-btn');
  const feedbackBox = document.getElementById('form-feedback');
  const commentsList = document.getElementById('comments-list');
  const totalCountBadge = document.getElementById('total-count');
  const paginationBar = document.getElementById('pagination-controls');
  const prevBtn = document.getElementById('prev-page-btn');
  const nextBtn = document.getElementById('next-page-btn');
  const pageIndicator = document.getElementById('page-indicator');

  const MAX_NAME = 100;
  const MAX_COMMENT = 500;
  let currentPage = 1;
  let totalPages = 1;
  let isSubmitting = false;

  if (pageIndicator) {
    const match = pageIndicator.textContent.match(/Page\s+(\d+)\s+of\s+(\d+)/i);
    if (match) {
      currentPage = parseInt(match[1], 10);
      totalPages = parseInt(match[2], 10);
    }
  }

  function showFeedback(message, type) {
    feedbackBox.textContent = message;
    feedbackBox.className = 'feedback-banner ' + (type === 'error' ? 'is-error' : 'is-success');
    feedbackBox.hidden = false;
  }

  function clearFeedback() {
    feedbackBox.textContent = '';
    feedbackBox.hidden = true;
    feedbackBox.className = 'feedback-banner';
  }

  function updateCharCounter() {
    const len = commentInput.value.length;
    charCount.textContent = len + ' / ' + MAX_COMMENT + ' characters';
    if (len > MAX_COMMENT) {
      charCount.classList.add('is-over-limit');
    } else {
      charCount.classList.remove('is-over-limit');
    }
  }

  function renderComments(data) {
    currentPage = data.currentPage;
    totalPages = data.totalPages;

    totalCountBadge.textContent =
      data.totalCount + (data.totalCount === 1 ? ' comment' : ' comments');

    commentsList.innerHTML = '';

    if (!data.comments || data.comments.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No comments yet—be the first to share your favorite donut!';
      commentsList.appendChild(empty);
    } else {
      data.comments.forEach(function (item) {
        const article = document.createElement('article');
        article.className = 'comment-card';

        const meta = document.createElement('div');
        meta.className = 'comment-meta';

        const author = document.createElement('strong');
        author.className = 'comment-author';
        // Decode entities safely via textContent so script tags never execute
        const parser = new DOMParser();
        author.textContent =
          parser.parseFromString(item.author_name, 'text/html').body.textContent || '';

        const time = document.createElement('time');
        time.className = 'comment-time';
        time.textContent = item.formatted_date;

        const body = document.createElement('p');
        body.className = 'comment-body';
        body.textContent =
          parser.parseFromString(item.comment_text, 'text/html').body.textContent || '';

        meta.appendChild(author);
        meta.appendChild(time);
        article.appendChild(meta);
        article.appendChild(body);
        commentsList.appendChild(article);
      });
    }

    if (totalPages > 1) {
      paginationBar.hidden = false;
      pageIndicator.textContent = 'Page ' + currentPage + ' of ' + totalPages;
      prevBtn.disabled = currentPage <= 1;
      nextBtn.disabled = currentPage >= totalPages;
    } else {
      paginationBar.hidden = true;
    }
  }

  async function loadPage(page) {
    try {
      const response = await fetch('/api/comments?page=' + encodeURIComponent(page));
      const data = await response.json();

      if (!response.ok) {
        showFeedback(
          data.error || 'Unable to load that page of comments right now.',
          'error'
        );
        return;
      }

      clearFeedback();
      renderComments(data);
    } catch (err) {
      showFeedback(
        'Cannot reach the Downtown Donuts server right now. Please check your connection and try again.',
        'error'
      );
    }
  }

  commentInput.addEventListener('input', updateCharCounter);
  updateCharCounter();

  prevBtn.addEventListener('click', function () {
    if (currentPage > 1) {
      loadPage(currentPage - 1);
    }
  });

  nextBtn.addEventListener('click', function () {
    if (currentPage < totalPages) {
      loadPage(currentPage + 1);
    }
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    // Edge case 4: Guard against rapid double-clicks
    if (isSubmitting) {
      return;
    }

    clearFeedback();

    const trimmedName = nameInput.value.trim();
    const trimmedComment = commentInput.value.trim();

    // Edge case 2: Reject empty or whitespace-only input
    if (!trimmedName) {
      showFeedback('Please enter your name (cannot be blank or spaces only).', 'error');
      nameInput.focus();
      return;
    }

    if (!trimmedComment) {
      showFeedback(
        'Please enter a comment before posting (whitespace-only comments are not allowed).',
        'error'
      );
      commentInput.focus();
      return;
    }

    // Edge case 3: Reject overly long input cleanly
    if (trimmedName.length > MAX_NAME) {
      showFeedback('Name must be ' + MAX_NAME + ' characters or fewer.', 'error');
      nameInput.focus();
      return;
    }

    if (trimmedComment.length > MAX_COMMENT) {
      showFeedback(
        'Your comment is ' +
          trimmedComment.length +
          ' characters long. Please shorten it to ' +
          MAX_COMMENT +
          ' characters or fewer.',
        'error'
      );
      commentInput.focus();
      return;
    }

    isSubmitting = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          author_name: trimmedName,
          comment_text: trimmedComment
        })
      });

      const data = await response.json();

      if (!response.ok) {
        showFeedback(
          data.error || 'We could not post your comment. Please check your input and try again.',
          'error'
        );
        return;
      }

      nameInput.value = '';
      commentInput.value = '';
      updateCharCounter();
      showFeedback(data.message || 'Your comment has been posted!', 'success');

      if (data.comments) {
        renderComments(data);
      } else {
        await loadPage(1);
      }
    } catch (err) {
      // Edge case 1: Unreachable server / network failure
      showFeedback(
        'Unable to reach the server right now. Your comment was not sent—please verify the server is running and try again.',
        'error'
      );
    } finally {
      isSubmitting = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Post Comment';
    }
  });
});
