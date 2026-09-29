const fs = require("node:fs/promises");
const path = require("node:path");
const puppeteer = require("puppeteer");

async function generatePDF({ html, filename = "document.pdf" }) {
    if (typeof html !== "string" || html.trim() === "") {
        throw new Error("generatePDF requires a non-empty html string");
    }

    const safeFilename = path
        .basename(filename)
        .replace(/[^a-zA-Z0-9._-]/g, "_")
        .replace(/\.pdf$/i, "");

    const finalFilename = `${safeFilename || "document"}.pdf`;
    const outputDirectory = path.resolve("outputs");
    const outputPath = path.join(outputDirectory, finalFilename);

    await fs.mkdir(outputDirectory, { recursive: true });

    const browser = await puppeteer.launch({
        headless: true,
    });

    try {
        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: "networkidle0",
        });

        await page.pdf({
            path: outputPath,
            format: "A4",
            printBackground: true,
            margin: {
                top: "20mm",
                right: "20mm",
                bottom: "20mm",
                left: "20mm",
            },
        });

        return {
            success: true,
            filename: finalFilename,
            path: outputPath,
        };
    } finally {
        await browser.close();
    }
}

module.exports = { generatePDF };
