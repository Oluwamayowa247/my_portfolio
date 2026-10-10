// Blog page: numbers the posts in the order they were written, runs the topic
// filter and the order switch, fills the progress bar, and picks up new posts
// from /api/posts.
(function () {
    'use strict';

    const TOPIC_NAMES = {
        flutter: 'Flutter',
        devlife: 'Dev life',
        android: 'Android & Java',
        backend: 'Backend',
    };
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const list = document.querySelector('.steps');
    const template = document.getElementById('step-template');
    const title = document.getElementById('steps-title');
    const status = document.querySelector('.js-status');
    const showAll = document.querySelector('.js-show-all');
    const progress = document.querySelector('.progress');
    const topicButtons = [...document.querySelectorAll('.pick')];
    const orderButtons = [...document.querySelectorAll('.seg__btn')];

    const state = { filter: null, order: 'newest' };

    // ---------- Posts ----------

    function chronological() {
        return [...list.children].sort((a, b) => a.dataset.date.localeCompare(b.dataset.date));
    }

    function countTopics(steps) {
        const counts = {};
        Object.keys(TOPIC_NAMES).forEach((topic) => { counts[topic] = 0; });
        steps.forEach((step) => { counts[step.dataset.topic] += 1; });
        return counts;
    }

    // Numbers every post, and makes the newest one the card. Needed on load
    // and whenever the set of posts changes.
    function numberSteps() {
        const steps = chronological();
        steps.forEach((step, index) => {
            const number = index + 1;
            step.id = 'step-' + number;
            step.querySelector('.js-num').textContent = number;
            step.classList.toggle('step--lead', number === steps.length);
        });
    }

    // Everything that depends on the filter, the order, or the totals.
    function refresh() {
        const steps = chronological();
        const total = steps.length;
        const counts = countTopics(steps);

        steps.forEach((step) => { step.hidden = Boolean(state.filter) && step.dataset.topic !== state.filter; });

        topicButtons.forEach((button) => {
            button.querySelector('.js-count').textContent = counts[button.dataset.topic];
            button.setAttribute('aria-pressed', String(button.dataset.topic === state.filter));
        });

        const shown = state.filter ? counts[state.filter] : total;
        const heading = state.filter
            ? `${shown} ${shown === 1 ? 'post' : 'posts'} about ${TOPIC_NAMES[state.filter]}`
            : `All ${total} posts`;
        title.textContent = heading;
        status.textContent = heading;
        showAll.hidden = !state.filter;
        showAll.textContent = `Show all ${total}`;

        const first = new Date(steps[0].dataset.date);
        const last = new Date(steps[total - 1].dataset.date);
        const minutes = steps.reduce((sum, step) => sum + Number(step.dataset.minutes), 0);
        setText('.js-total', total);
        setText('.js-minutes-total', minutes);
        setText('.js-range', `${monthYear(first)} and ${monthYear(last)}`);
        setText('.js-next', total + 1);

        progress.innerHTML = [...list.children]
            .filter((step) => !step.hidden)
            .map((step) => `<span data-topic="${step.dataset.topic}" data-step="${step.id}"></span>`)
            .join('');
        updateProgress();
    }

    function setText(selector, value) {
        document.querySelectorAll(selector).forEach((element) => { element.textContent = value; });
    }

    function monthYear(date) {
        return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
    }

    function applyOrder() {
        const steps = chronological();
        if (state.order === 'newest') steps.reverse();
        list.append(...steps);
        orderButtons.forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.order === state.order));
        });
    }

    // Fills the bar along the bottom as each post passes the middle of the screen.
    function updateProgress() {
        const middle = window.innerHeight / 2;
        progress.querySelectorAll('span').forEach((segment) => {
            const step = document.getElementById(segment.dataset.step);
            segment.classList.toggle('is-done', step.getBoundingClientRect().top < middle);
        });
    }

    // ---------- New posts from the feed ----------

    function formatDay(date) {
        return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}`;
    }

    // Writes a post into a row. Returns false when nothing changed.
    function fill(step, post) {
        const link = step.querySelector('.step__title a');
        const hook = step.querySelector('.step__hook');
        const date = new Date(post.date);
        const next = {
            topic: TOPIC_NAMES[post.topic] ? post.topic : 'devlife',
            date: date.toISOString(),
            minutes: String(Math.max(1, Math.round(Number(post.minutes)) || 1)),
            title: String(post.title),
            hook: String(post.hook || ''),
        };
        if (step.dataset.topic === next.topic && step.dataset.date === next.date && step.dataset.minutes === next.minutes
            && link.textContent === next.title && hook.textContent === next.hook) return false;

        step.dataset.topic = next.topic;
        step.dataset.date = next.date;
        step.dataset.minutes = next.minutes;
        link.href = post.url;
        link.textContent = next.title;
        hook.textContent = next.hook;
        const time = step.querySelector('time');
        time.dateTime = next.date.slice(0, 10);
        time.textContent = formatDay(date);
        step.querySelector('.js-minutes').textContent = `${next.minutes} min read`;
        step.querySelector('.js-topic').textContent = TOPIC_NAMES[next.topic];
        return true;
    }

    function merge(posts) {
        const known = new Map([...list.children].map((step) => [step.querySelector('.step__title a').href, step]));
        let changed = false;
        posts.forEach((post) => {
            if (!post || typeof post.url !== 'string' || !/^https:\/\//.test(post.url)) return;
            if (!post.title || Number.isNaN(Date.parse(post.date))) return;
            let step = known.get(new URL(post.url).href);
            if (!step) {
                step = template.content.firstElementChild.cloneNode(true);
                list.append(step);
            }
            changed = fill(step, post) || changed;
        });
        if (!changed) return;
        applyOrder();
        numberSteps();
        refresh();
    }

    // ---------- Start ----------

    numberSteps();
    refresh();

    topicButtons.forEach((button) => {
        button.addEventListener('click', () => {
            state.filter = state.filter === button.dataset.topic ? null : button.dataset.topic;
            refresh();
        });
    });

    showAll.addEventListener('click', () => {
        state.filter = null;
        refresh();
        title.focus();
    });

    orderButtons.forEach((button) => {
        button.addEventListener('click', () => {
            state.order = button.dataset.order;
            applyOrder();
            refresh();
        });
    });

    let ticking = false;
    function onScroll() {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            ticking = false;
            updateProgress();
        });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);

    // The page already holds every post it was built with. This only adds or
    // corrects posts published since, and does nothing if the feed is unreachable.
    fetch('/api/posts')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => { if (data && Array.isArray(data.posts)) merge(data.posts); })
        .catch(() => {});
})();
