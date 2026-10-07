// The brick drawing both pages share: an isometric projection, and the faces
// and studs of a box. Every size is in studs; `s` is how many pixels a stud is.
(function () {
    'use strict';

    const BRICK_H = 1.2;
    const STUD_R = 0.3;
    const STUD_H = 0.2;
    const COS = Math.cos(Math.PI / 6);

    function point(x, y, z, s) {
        return [(x - y) * COS * s, ((x + y) / 2 - z) * s];
    }

    function face(points) {
        return 'M' + points.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + 'Z';
    }

    // The three faces of a box you can see from the front.
    function boxFaces(x, y, z, width, depth, height, s) {
        const x1 = x + width;
        const y1 = y + depth;
        const z1 = z + height;
        return {
            top: face([point(x, y, z1, s), point(x1, y, z1, s), point(x1, y1, z1, s), point(x, y1, z1, s)]),
            left: face([point(x, y1, z1, s), point(x1, y1, z1, s), point(x1, y1, z, s), point(x, y1, z, s)]),
            right: face([point(x1, y, z1, s), point(x1, y1, z1, s), point(x1, y1, z, s), point(x1, y, z, s)]),
        };
    }

    function studPaths(x, y, z, across, deep, s) {
        const rx = (STUD_R * COS * Math.SQRT2 * s).toFixed(1);
        const ry = (STUD_R * Math.SQRT1_2 * s).toFixed(1);
        const rise = STUD_H * s;
        let sides = '';
        let tops = '';
        for (let i = 0; i < across; i++) {
            for (let j = 0; j < deep; j++) {
                const [cx, cy] = point(x + i + 0.5, y + j + 0.5, z, s);
                const left = (cx - rx).toFixed(1);
                const right = (cx + Number(rx)).toFixed(1);
                const top = (cy - rise).toFixed(1);
                const bottom = cy.toFixed(1);
                sides += `M${left} ${top}V${bottom}A${rx} ${ry} 0 0 0 ${right} ${bottom}V${top}Z`;
                tops += `M${left} ${top}A${rx} ${ry} 0 1 0 ${right} ${top}A${rx} ${ry} 0 1 0 ${left} ${top}Z`;
            }
        }
        return { sides, tops };
    }

    // A studded box: a brick, or a plate when it is thin. `studClass` is an
    // extra class for the studs, with a trailing space.
    function box(x, y, z, width, depth, height, s, attributes, studClass = '') {
        const faces = boxFaces(x, y, z, width, depth, height, s);
        const studs = studPaths(x, y, z + height, width, depth, s);
        return `<g ${attributes}>` +
            `<path class="f-right" d="${faces.right}"/><path class="f-left" d="${faces.left}"/><path class="f-top" d="${faces.top}"/>` +
            `<path class="${studClass}f-left" d="${studs.sides}"/><path class="${studClass}f-top" d="${studs.tops}"/></g>`;
    }

    // A single 2x2 brick for the call-outs and the inventory. Its color comes
    // from the nearest [data-topic] ancestor.
    function drawBrick(svg) {
        const s = 9;
        const halfWidth = 2 * COS * s + 2;
        const top = -(BRICK_H + STUD_H) * s - 3;
        svg.setAttribute('viewBox', `${(-halfWidth).toFixed(1)} ${top.toFixed(1)} ${(halfWidth * 2).toFixed(1)} ${(2 * s + 2 - top).toFixed(1)}`);
        svg.innerHTML = box(0, 0, 0, 2, 2, BRICK_H, s, 'class="bk"');
    }

    window.Bricks = { BRICK_H, STUD_H, COS, point, boxFaces, box, drawBrick };
})();
