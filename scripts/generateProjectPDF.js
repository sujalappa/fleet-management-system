/**
 * Convert the Bhushilp project HTML document to PDF
 * Usage: node scripts/generateProjectPDF.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function generatePDF() {
  try {
    // Check if html-pdf is available, if not, use puppeteer or built-in approach
    let pdf;

    try {
      const htmlPdf = await import("html-pdf");
      pdf = htmlPdf.default;
    } catch (e) {
      console.log("html-pdf not installed. Installing...");
      // Fallback: use a different approach
      console.log("Attempting to use an alternative PDF generation method...");
    }

    // Read the HTML file
    const htmlPath = path.join(__dirname, "../Bhushilp_Project_Document.html");
    const htmlContent = fs.readFileSync(htmlPath, "utf-8");

    // Output PDF path
    const outputPath = path.join(__dirname, "../Bhushilp_Project_Document.pdf");

    if (pdf) {
      // Use html-pdf if available
      pdf.create(htmlContent, {
        format: "A4",
        orientation: "portrait",
        margin: "1cm"
      }).toFile(outputPath, (err, res) => {
        if (err) {
          console.error("Error generating PDF:", err);
          process.exit(1);
        }
        console.log(`✅ PDF generated successfully at: ${outputPath}`);
        process.exit(0);
      });
    } else {
      // Fallback: try using puppeteer
      try {
        const puppeteer = await import("puppeteer");
        const browser = await puppeteer.default.launch({ headless: "new" });
        const page = await browser.newPage();

        // Write temp HTML file with absolute paths resolved
        const tempHtmlPath = path.join(__dirname, "../scratchpad/temp_project.html");
        fs.writeFileSync(tempHtmlPath, htmlContent);

        await page.goto(`file://${tempHtmlPath}`, { waitUntil: "networkidle2" });
        await page.pdf({
          path: outputPath,
          format: "A4",
          margin: { top: "1cm", right: "1cm", bottom: "1cm", left: "1cm" }
        });

        await browser.close();
        fs.unlinkSync(tempHtmlPath);

        console.log(`✅ PDF generated successfully at: ${outputPath}`);
        process.exit(0);
      } catch (puppeteerErr) {
        console.error(
          "Neither html-pdf nor puppeteer available. Please install one:\n" +
          "  npm install html-pdf\n" +
          "  OR\n" +
          "  npm install puppeteer"
        );
        process.exit(1);
      }
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

generatePDF();
