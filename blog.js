// Blog page: draws the brick model and the step diagrams, runs the parts
// filter and the step order, and picks up new posts from /api/posts.
// Needs bricks.js loaded first.
(function () {
    'use strict';

    const TOPIC_NAMES = {
        flutter: 'Flutter',
        devlife: 'Dev life',
        android: 'Android & Java',
        backend: 'Backend',
    };
    const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const { BRICK_H, STUD_H, COS, point, boxFaces, box, drawBrick } = window.Bricks;

    // Model geometry, in studs.
    const BRICK = 2;
    const PLATE = 7;
    const PLATE_H = 0.4;
    const LIFT = 3; // how high a new brick floats above its seat
    // Where each column stands, back to front. The busiest topic goes at the
    // back so the shorter columns never hide it.
    const SLOTS = [[1, 1], [1, 4], [4, 1], [4, 4]];

    const list = document.querySelector('.steps');
    const template = document.getElementById('step-template');
    const hero = document.getElementById('model');
    const title = document.getElementById('steps-title');
    const status = document.querySelector('.js-status');
    const showAll = document.querySelector('.js-show-all');
    const progress = document.querySelector('.progress');
    const partButtons = [...document.querySelectorAll('.partbtn')];
    const orderButtons = [...document.querySelectorAll('.seg__btn')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const state = { filter: null, order: 'newest', drawn: false };

    // ---------- Drawing ----------

    function brick(x, y, z, s, attributes) {
        return box(x, y, z, BRICK, BRICK, BRICK_H, s, attributes);
    }

    function plate(s) {
        return box(0, 0, -PLATE_H, PLATE, PLATE, PLATE_H, s, 'class="pl"', 'pl-stud ');
    }

    // The seat outline and arrow that show where a floating brick lands.
    function guide(x, y, z, s) {
        const seat = boxFaces(x, y, z - BRICK_H, BRICK, BRICK, BRICK_H, s).top;
        const [cx, from] = point(x + BRICK, y + BRICK, z + LIFT, s);
        const [, to] = point(x + BRICK / 2, y + BRICK / 2, z, s);
        const head = Math.max(5, s * 0.5);
        const tip = to - s * 0.1;
        const start = from + s * 0.35;
        return '<g class="guide">' +
            `<path class="seat" d="${seat}"/>` +
            `<path class="shaft" d="M${cx.toFixed(1)} ${start.toFixed(1)}V${(tip - head).toFixed(1)}"/>` +
            `<path class="head" d="M${(cx - head * 0.7).toFixed(1)} ${(tip - head).toFixed(1)}h${(head * 1.4).toFixed(1)}L${cx.toFixed(1)} ${tip.toFixed(1)}Z"/></g>`;
    }

    // Draws the model built from `sequence`, a list of { topic, ghost } in the
    // order the posts were written. With `float`, the last brick hovers above
    // its seat, the way an instruction step shows the piece being added.
    function drawModel(svg, sequence, options) {
        const s = options.scale;
        const columns = SLOTS.map(() => []);
        sequence.forEach((item, index) => columns[options.slots[item.topic]].push({ ...item, index }));

        let markup = plate(s);
        let highest = 0;
        columns.forEach((column, slot) => {
            const [x, y] = SLOTS[slot];
            column.forEach((item, level) => {
                const floating = options.float && item.index === sequence.length - 1;
                const z = level * BRICK_H;
                const attributes = item.ghost
                    ? `class="bk bk--ghost" style="--i:${item.index}"`
                    : `class="bk" data-topic="${item.topic}" style="--i:${item.index}"`;
                if (floating) {
                    markup += guide(x, y, z, s);
                    markup += `<g class="drop" style="--lift:${(LIFT * s).toFixed(1)}px">${brick(x, y, z + LIFT, s, attributes)}</g>`;
                } else {
                    markup += brick(x, y, z, s, attributes);
                }
                const top = z + BRICK_H + STUD_H + (floating ? LIFT : 0);
                highest = Math.min(highest, point(x, y, top, s)[1]);
            });
        });

        const pad = 3;
        const halfWidth = PLATE * COS * s + pad;
        const bottom = (PLATE + PLATE_H) * s + pad;
        const width = Math.ceil(halfWidth * 2);
        const height = Math.ceil(bottom - highest + pad);
        svg.setAttribute('viewBox', `${(-halfWidth).toFixed(1)} ${(highest - pad).toFixed(1)} ${width} ${height}`);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.innerHTML = markup;
    }

    // ---------- Steps ----------

    function chronological() {
        return [...list.children].sort((a, b) => a.dataset.date.localeCompare(b.dataset.date));
    }

    function slotsFor(steps) {
        const counts = countTopics(steps);
        const slots = {};
        Object.keys(TOPIC_NAMES)
            .sort((a, b) => counts[b] - counts[a])
            .forEach((topic, slot) => { slots[topic] = slot; });
        return slots;
    }

    function countTopics(steps) {
        const counts = {};
        Object.keys(TOPIC_NAMES).forEach((topic) => { counts[topic] = 0; });
        steps.forEach((step) => { counts[step.dataset.topic] += 1; });
        return counts;
    }

    // Numbers every step and redraws its diagram. Needed on load and whenever
    // the set of posts changes.
    function numberSteps() {
        const steps = chronological();
        const slots = slotsFor(steps);
        steps.forEach((step, index) => {
            const number = index + 1;
            const newest = number === steps.length;
            step.id = 'step-' + number;
            step.querySelector('.js-num').textContent = number;
            step.classList.toggle('step--lead', newest);
            const sequence = steps.slice(0, number).map((earlier, i) => ({ topic: earlier.dataset.topic, ghost: i < index }));
            drawModel(step.querySelector('.step__dgm'), sequence, { scale: newest ? 17 : 9, slots, float: true });
        });
    }

    // Everything that depends on the filter, the order, or the totals.
    function refresh() {
        const steps = chronological();
        const total = steps.length;
        const counts = countTopics(steps);

        steps.forEach((step) => { step.hidden = Boolean(state.filter) && step.dataset.topic !== state.filter; });

        // After the first draw the model no longer replays its assembly.
        if (state.drawn) hero.classList.remove('model--build');
        drawModel(hero, steps.map((step) => ({
            topic: step.dataset.topic,
            ghost: Boolean(state.filter) && step.dataset.topic !== state.filter,
        })), { scale: 30, slots: slotsFor(steps), float: false });
        state.drawn = true;

        partButtons.forEach((button) => {
            button.querySelector('.js-count').textContent = counts[button.dataset.topic];
            button.setAttribute('aria-pressed', String(button.dataset.topic === state.filter));
        });

        const shown = state.filter ? counts[state.filter] : total;
        const heading = state.filter
            ? `${shown} ${shown === 1 ? 'step uses' : 'steps use'} ${TOPIC_NAMES[state.filter]}`
            : `All ${total} steps`;
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

    // Fills the bar along the bottom as each step passes the middle of the screen.
    function updateProgress() {
        const middle = window.innerHeight / 2;
        progress.querySelectorAll('span').forEach((segment) => {
            const step = document.getElementById(segment.dataset.step);
            segment.classList.toggle('is-done', step.getBoundingClientRect().top < middle);
        });
    }

    // Each diagram's new brick clicks into place the first time you reach it.
    const seating = reducedMotion ? null : new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            seating.unobserve(entry.target);
            setTimeout(() => entry.target.classList.add('is-seated'), 350);
        });
    }, { threshold: 0.75 });

    function watch(step) {
        if (seating) seating.observe(step.querySelector('.step__dgm'));
    }

    // ---------- New posts from the feed ----------

    function formatDay(date) {
        return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()].slice(0, 3)} ${date.getUTCFullYear()}`;
    }

    // Writes a post into a step. Returns false when nothing changed.
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
                drawBrick(step.querySelector('.brick'));
                list.append(step);
                watch(step);
            }
            changed = fill(step, post) || changed;
        });
        if (!changed) return;
        applyOrder();
        numberSteps();
        refresh();
    }

    // ---------- Start ----------

    document.querySelectorAll('.brick').forEach(drawBrick);
    numberSteps();
    refresh();
    [...list.children].forEach(watch);

    partButtons.forEach((button) => {
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
