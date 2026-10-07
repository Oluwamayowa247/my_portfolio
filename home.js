// Home page: draws the 3-in-1 model and rebuilds it when you pick a build,
// draws each build beside its section, and picks up new posts from /api/posts.
// Needs bricks.js loaded first.
(function () {
    'use strict';

    const { BRICK_H, STUD_H, COS, point, box, drawBrick } = window.Bricks;

    const TOPIC_NAMES = {
        flutter: 'Flutter',
        devlife: 'Dev life',
        android: 'Android & Java',
        backend: 'Backend',
    };
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Model geometry, in studs.
    const PLATE = 8;
    const PLATE_H = 0.4;
    const WIDTHS = { bar: 4, pair: 2, cube: 1 };
    const HOP = 0.9;     // how far a brick lifts off its seat before it travels
    const SPREAD = 0.12; // extra lift per level, so a stack pulls apart on the way up

    // The one box of bricks. Every build uses all 19, in this order.
    const PARTS = [
        ['bar', 'blue'], ['bar', 'blue'],
        ['cube', 'blue'], ['cube', 'blue'], ['cube', 'blue'], ['cube', 'blue'], ['cube', 'blue'],
        ['cube', 'blue'], ['cube', 'blue'], ['cube', 'blue'], ['cube', 'blue'], ['cube', 'blue'],
        ['cube', 'yellow'], ['cube', 'yellow'], ['cube', 'yellow'], ['cube', 'yellow'],
        ['pair', 'red'], ['pair', 'green'], ['pair', 'white'],
    ];

    // Where each brick sits in each build, as [x, y, level], one per brick
    // above. Every brick is one stud deep and sits on a whole-numbered row.
    const BUILDS = {
        // A phone standing on its end: a blue case around a screen of bricks.
        phone: [
            [2, 3, 0], [2, 3, 6],
            [2, 3, 1], [5, 3, 1], [2, 3, 2], [5, 3, 2], [2, 3, 3],
            [5, 3, 3], [2, 3, 4], [5, 3, 4], [2, 3, 5], [5, 3, 5],
            [3, 3, 1], [4, 3, 1], [3, 3, 4], [4, 3, 4],
            [3, 3, 2], [3, 3, 3], [3, 3, 5],
        ],
        // A typewriter: three rows of keys and a space bar in front, and at the
        // back a carriage wider than the body with a page in it.
        typewriter: [
            [0, 2, 1], [4, 2, 1],
            [2, 2, 0], [3, 2, 0], [4, 2, 0], [5, 2, 0], [2, 3, 0],
            [5, 3, 0], [2, 5, 0], [3, 5, 0], [4, 5, 0], [5, 5, 0],
            [2, 4, 0], [3, 4, 0], [4, 4, 0], [5, 4, 0],
            [3, 3, 0], [3, 6, 0], [3, 2, 2],
        ],
        // One person on a soapbox and three listening.
        crowd: [
            [1, 1, 0], [1, 2, 0],
            [2, 2, 1], [3, 2, 1], [2, 2, 2], [3, 2, 2], [0, 5, 0],
            [1, 5, 0], [5, 7, 0], [6, 7, 0], [6, 3, 0], [7, 3, 0],
            [2.5, 2, 3], [0.5, 5, 2], [5.5, 7, 2], [6.5, 3, 2],
            [0, 5, 1], [5, 7, 1], [6, 3, 1],
        ],
    };

    const hero = document.getElementById('model');
    const note = document.querySelector('.js-note');
    const buildButtons = [...document.querySelectorAll('.partbtn')];
    const figures = [...document.querySelectorAll('.fig')];
    const postRows = [...document.querySelectorAll('.js-post')];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------- Drawing ----------

    function seats(name) {
        return BUILDS[name].map(([x, y, level]) => ({ x, y, z: level * BRICK_H }));
    }

    function rise(z) {
        return z + HOP + (z / BRICK_H) * SPREAD;
    }

    const CEILING = Math.max(...Object.keys(BUILDS).flatMap((name) => seats(name).map((seat) => rise(seat.z))));

    // Where a brick hovers between leaving one seat and reaching the next.
    function hover(spot) {
        return { x: spot.x, y: spot.y, z: Math.min(rise(spot.z), CEILING) };
    }

    // Every brick is one stud deep, so back row first and then bottom up is
    // the order they have to be painted in.
    function byDepth(a, b) {
        return a.y - b.y || a.z - b.z || a.x - b.x;
    }

    function place(brick, s) {
        const [left, top] = point(brick.x, brick.y, brick.z, s);
        brick.node.setAttribute('transform', `translate(${left.toFixed(1)} ${top.toFixed(1)})`);
    }

    // Sizes a drawing to its plate and to the highest of `spots`.
    function frame(svg, spots, s) {
        const pad = 3;
        const top = Math.min(...spots.map((spot) => point(spot.x, spot.y, spot.z + BRICK_H + STUD_H, s)[1]));
        const halfWidth = PLATE * COS * s + pad;
        const bottom = (PLATE + PLATE_H) * s + pad;
        const width = Math.ceil(halfWidth * 2);
        const height = Math.ceil(bottom - top + pad);
        svg.setAttribute('viewBox', `${(-halfWidth).toFixed(1)} ${(top - pad).toFixed(1)} ${width} ${height}`);
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
    }

    // Draws a build on its plate and returns its bricks, each with the node
    // that draws it. `--i` is the order they drop in.
    function drawBuild(svg, name, s) {
        const bricks = seats(name).map((seat, index) => ({ ...seat, kind: PARTS[index][0], color: PARTS[index][1] }));
        const order = [...bricks].sort(byDepth);
        svg.innerHTML = box(0, 0, -PLATE_H, PLATE, PLATE, PLATE_H, s, 'class="pl"', 'pl-stud ') + order.map((brick, i) =>
            `<g>${box(0, 0, 0, WIDTHS[brick.kind], 1, BRICK_H, s, `class="bk" data-c="${brick.color}" style="--i:${i}"`)}</g>`).join('');
        order.forEach((brick, i) => {
            brick.node = svg.children[i + 1];
            place(brick, s);
        });
        return bricks;
    }

    // ---------- The model that rebuilds ----------

    const SCALE = 26;
    // Milliseconds.
    const LIFT = 260;
    const TRAVEL = 460;
    const DROP = 360;

    let bricks = [];
    let painted = [];
    let frameId = 0;

    function paint() {
        bricks.forEach((brick) => place(brick, SCALE));
        const order = [...bricks].sort(byDepth);
        if (order.every((brick, i) => brick === painted[i])) return;
        hero.append(...order.map((brick) => brick.node));
        painted = order;
    }

    function span(t, start, length) {
        return Math.min(1, Math.max(0, (t - start) / length));
    }

    function easeOut(t) {
        return 1 - Math.pow(1 - t, 4);
    }

    function easeInOut(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(2 - 2 * t, 3) / 2;
    }

    // Each spot's place in line once the spots are sorted.
    function ranks(spots, compare) {
        const rank = [];
        spots.map((spot, index) => index)
            .sort((a, b) => compare(spots[a], spots[b]))
            .forEach((index, position) => { rank[index] = position; });
        return rank;
    }

    // Takes the model apart and seats the same bricks as another build: they
    // lift off from the top down, cross over in the air, and land from the
    // bottom up.
    function rebuild(name) {
        const to = seats(name);
        cancelAnimationFrame(frameId);
        hero.classList.remove('model--build');
        if (reducedMotion) {
            bricks.forEach((brick, i) => Object.assign(brick, to[i]));
            paint();
            return;
        }

        const from = bricks.map(({ x, y, z }) => ({ x, y, z }));
        const up = from.map(hover);
        const over = to.map(hover);
        const leaving = ranks(from, (a, b) => b.z - a.z || byDepth(b, a));
        const landing = ranks(to, (a, b) => a.z - b.z || byDepth(a, b));
        const travelAt = LIFT + bricks.length * 12;
        const dropAt = travelAt + TRAVEL + bricks.length * 8;
        const start = performance.now();

        function tick(now) {
            const t = now - start;
            let seated = true;
            bricks.forEach((brick, i) => {
                const lift = easeOut(span(t, leaving[i] * 12, LIFT));
                const travel = easeInOut(span(t, travelAt + i * 8, TRAVEL));
                const drop = easeOut(span(t, dropAt + landing[i] * 26, DROP));
                brick.x = up[i].x + (over[i].x - up[i].x) * travel;
                brick.y = up[i].y + (over[i].y - up[i].y) * travel;
                brick.z = from[i].z + (up[i].z - from[i].z) * lift + (over[i].z - up[i].z) * travel + (to[i].z - over[i].z) * drop;
                if (drop < 1) seated = false;
            });
            // Land on the exact seat, so neighbors sort by position and not by rounding.
            if (seated) bricks.forEach((brick, i) => Object.assign(brick, to[i]));
            paint();
            if (!seated) frameId = requestAnimationFrame(tick);
        }
        frameId = requestAnimationFrame(tick);
    }

    function choose(button) {
        buildButtons.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
        note.textContent = button.dataset.note;
        rebuild(button.dataset.build);
    }

    // ---------- New posts from the feed ----------

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

    // ---------- Start ----------

    document.querySelectorAll('.brick').forEach(drawBrick);

    const first = buildButtons.find((button) => button.getAttribute('aria-pressed') === 'true');
    bricks = drawBuild(hero, first.dataset.build, SCALE);
    painted = [...bricks].sort(byDepth);
    // Room above the plate for the tallest build with its bricks in the air.
    frame(hero, Object.keys(BUILDS).flatMap((name) => seats(name).map(hover)), SCALE);

    buildButtons.forEach((button) => {
        button.addEventListener('click', () => {
            if (button.getAttribute('aria-pressed') !== 'true') choose(button);
        });
    });

    figures.forEach((svg) => frame(svg, drawBuild(svg, svg.dataset.build, 13), 13));

    // Each build beside its section drops together the first time you reach it.
    if (!reducedMotion) {
        const building = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                building.unobserve(entry.target);
                entry.target.classList.replace('fig--waiting', 'fig--build');
            });
        }, { threshold: 0.6 });
        figures.forEach((svg) => {
            svg.classList.add('fig--waiting');
            building.observe(svg);
        });
    }

    // The page already holds the three newest posts it was built with. This
    // swaps in anything published since, and does nothing if the feed is unreachable.
    fetch('/api/posts')
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => { if (data && Array.isArray(data.posts)) showPosts(data.posts); })
        .catch(() => {});
})();
