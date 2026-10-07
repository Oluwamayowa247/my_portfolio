// Vercel function: GET /api/posts
// Reads the blog's RSS feed on the server and returns the posts as JSON for
// blog.js. The feed sends no CORS header, so a browser can't read it directly,
// and Hashnode's GraphQL API has needed a paid plan since May 2026.

const FEED_URL = 'https://mayourwa.hashnode.dev/rss.xml';
const WORDS_PER_MINUTE = 200;

// First match wins, tested against the title and tags. Anything else is 'devlife'.
const TOPICS = [
    ['flutter', /\b(flutter|dart|inkwell|widgets?)\b/i],
    ['android', /\b(android|java)\b/i],
    ['backend', /\b(node(\.?js)?|backend|javascript|passwords?|server)\b/i],
];

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };

function text(raw) {
    const value = raw.trim();
    // CDATA is already literal text; only bare values carry entities.
    if (value.startsWith('<![CDATA[')) return value.slice(9, -3).trim();
    return value.replace(/&(amp|lt|gt|quot|apos|#39);/g, (match, name) => ENTITIES[name]);
}

function field(item, tag) {
    const match = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return match ? text(match[1]) : '';
}

function topicOf(title, tags) {
    const haystack = [title, ...tags].join(' ');
    const found = TOPICS.find(([, pattern]) => pattern.test(haystack));
    return found ? found[0] : 'devlife';
}

function minutesOf(html) {
    const words = html
        .replace(/<pre[\s\S]*?<\/pre>/g, ' ')
        .replace(/<[^>]+>/g, ' ')
        .split(/\s+/)
        .filter(Boolean).length;
    return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

// Hashnode's summary is the opening of the article, cut off with "...".
function hookOf(description) {
    return description
        .replace(/\bvia GIPHY\b/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\.{3}$/, '…')
        .trim();
}

function parseFeed(xml) {
    return xml
        .split('<item>')
        .slice(1)
        .map((item) => {
            const title = field(item, 'title');
            const url = field(item, 'link');
            const date = new Date(field(item, 'pubDate'));
            if (!title || !/^https:\/\//.test(url) || Number.isNaN(date.getTime())) return null;
            const tags = [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((match) => text(match[1]));
            return {
                title,
                url,
                date: date.toISOString(),
                minutes: minutesOf(field(item, 'content:encoded')),
                topic: topicOf(title, tags),
                hook: hookOf(field(item, 'description')),
            };
        })
        .filter(Boolean)
        .sort((a, b) => b.date.localeCompare(a.date));
}

module.exports = async (req, res) => {
    try {
        const feed = await fetch(FEED_URL);
        if (!feed.ok) throw new Error(`Feed responded with ${feed.status}`);
        const posts = parseFeed(await feed.text());
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        res.status(200).json({ posts });
    } catch (error) {
        console.error(error);
        res.status(502).json({ error: 'Could not read the blog feed.' });
    }
};

module.exports.parseFeed = parseFeed;
