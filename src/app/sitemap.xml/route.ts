export async function GET() {
    const baseUrl = "https://voxlo.app";

    // In a real app, you might fetch your static paths or cities here
    const paths = [
        "",
        "/privacy",
        "/terms",
    ];

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      ${paths
            .map((path) => {
                return `
            <url>
              <loc>${baseUrl}${path}</loc>
              <lastmod>${new Date().toISOString()}</lastmod>
              <changefreq>daily</changefreq>
              <priority>${path === "" ? "1.0" : "0.5"}</priority>
            </url>
          `;
            })
            .join("")}
    </urlset>
  `;

    return new Response(sitemap, {
        headers: {
            "Content-Type": "application/xml",
        },
    });
}
