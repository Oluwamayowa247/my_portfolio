// Home page: picks up new posts from /api/posts for the three newest articles
// and the counts around them.
(function () {
    'use strict';

    const TOPIC_NAMES = {
        flutter: 'Flutter',
        devlife: 'Dev life',
        android: 'Android & Java',
        backend: 'Backend',
    };
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const postRows = [...document.querySelectorAll('.js-post')];

    function minutesOf(post) {
        return Math.max(1, Math.round(Number(post.minutes)) || 1);
    }

    function setText(selector, value) {
        document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
    }

    function showPosts(feed) {
        const posts = feed
            .filter((post) => post && typeof post.url === 'string' && /^https:\/\//.test(post.url)
                && post.title && !Number.isNaN(Date.parse(post.date)))
            .map((post) => ({ ...post, topic: TOPIC_NAMES[post.topic] ? post.topic : 'devlife' }))
            .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
        if (posts.length < postRows.length) return;

        setText('.js-total', posts.length);
        setText('.js-minutes-total', posts.reduce((sum, post) => sum + minutesOf(post), 0));
        document.querySelectorAll('.kit [data-topic]').forEach((part) => {
            part.querySelector('.js-count').textContent = posts.filter((post) => post.topic === part.dataset.topic).length;
        });

        postRows.forEach((row, index) => {
            const post = posts[index];
            const date = new Date(post.date);
            const link = row.querySelector('.step__title a');
            const time = row.querySelector('time');
            row.dataset.topic = post.topic;
            row.querySelector('.js-num').textContent = posts.length - index;
            row.querySelector('.js-topic').textContent = TOPIC_NAMES[post.topic];
            link.href = post.url;
            link.textContent = String(post.title);
            row.querySelector('.step__hook').textContent = String(post.hook || '');
            time.dateTime = date.toISOString().slice(0, 10);
            time.textContent = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
            row.querySelector('.js-minutes').textContent = `${minutesOf(post)} min read`;
        });
    }

    // The page already holds the three newest posts it was built with. This
    // swaps in anything published since, and does nothing if the feed is unreachable.
    fetch('/api/posts')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => { if (data && Array.isArray(data.posts)) showPosts(data.posts); })
        .catch(() => {});
})();
