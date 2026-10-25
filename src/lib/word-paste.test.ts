import { describe, expect, it } from "vitest";
import { isWordHtml, normalizeWordHtml } from "./word-paste";

const photo = "data:image/png;base64,iVBORw0KGgo=";
const parse = (html: string) => new DOMParser().parseFromString(html, "text/html").body;

describe("Word clipboard conversion", () => {
  it("recovers Word Online headings, inline emphasis, tables and SVG-wrapped photos", () => {
    const clipboard = `<div class="OutlineElement SCXW123 BCX0">
      <p><span data-ccp-parastyle="Title">Fan overview</span><span class="EOP">&nbsp;</span></p>
      <p role="heading" aria-level="2"><span style="font-weight:normal">Technical details</span></p>
      <p>Motor: <span style="font-weight:bold">EC</span> <span style="font-style:italic;text-decoration:underline">adjustable</span></p>
      <table style="width:0px"><tr><td colspan="2" style="border:1px solid black;width:300px">Performance</td></tr>
      <tr><td rowspan="2" style="width:100px">Flow</td><td style="width:200px">1400</td></tr><tr><td>1200</td></tr></table>
      <span class="WACSvg" style="position:absolute"><svg style="width:274px;height:274px"><desc>Fan front</desc><g><image href="${photo}" /></g></svg></span>
    </div>`;
    expect(isWordHtml(clipboard)).toBe(true);
    const result = normalizeWordHtml(clipboard);
    const body = parse(result.html);
    expect(result.missingImages).toBe(0);
    expect(body.querySelector("h1")).toBeNull();
    expect(body.querySelector("h2.word-heading-1")?.textContent).toBe("Fan overview");
    expect(body.querySelector("h3.word-heading-2")?.textContent).toBe("Technical details");
    expect(body.querySelector("strong")?.textContent).toBe("EC");
    expect(body.querySelector("u em")?.textContent).toBe("adjustable");
    expect(body.querySelector('td[colspan="2"]')?.textContent).toBe("Performance");
    expect(body.querySelector('td[rowspan="2"]')?.textContent).toBe("Flow");
    expect(body.querySelector(".word-table--bordered table")?.getAttribute("style")).toContain("width: 100%");
    expect(body.querySelector("img")?.getAttribute("src")).toBe(photo);
    expect(body.querySelector("img")?.getAttribute("alt")).toBe("Fan front");
    expect(body.querySelector("svg,script,[data-ccp-parastyle],.SCXW123")).toBeNull();
    expect(result.html).not.toContain("position:");
  });

  it("keeps semantic Word desktop formatting and ordinary web or embedded images", () => {
    const body = parse(normalizeWordHtml(`<p class="MsoHeading1">Heading</p><p class="MsoNormal"><b>Bold <span style="font-weight:normal">plain</span></b><i>italic</i></p><img src="/storage/fan.webp" alt="Uploaded"><img src="${photo}">`).html);
    expect(body.querySelector("h2.word-heading-1")?.textContent).toBe("Heading");
    expect(body.querySelector("strong")?.textContent).toBe("Bold ");
    expect(body.querySelector("em")?.textContent).toBe("italic");
    expect(body.querySelectorAll("img")).toHaveLength(2);
    expect(isWordHtml("<p>Ordinary <strong>HTML</strong></p>")).toBe(false);
  });

  it("reports unavailable pictures and removes active content and unsafe links", () => {
    const result = normalizeWordHtml(`<p class="MsoNormal" onclick="bad()">Text<script>bad()</script></p><img src="file:///C:/photo.png"><svg><path d="M0 0"></path></svg><a href="javascript:alert(1)">link</a><img src="${photo}" onerror="bad()">`);
    expect(result.missingImages).toBe(2);
    expect(result.html).not.toMatch(/onclick|onerror|javascript:|bad\(\)|file:|<script|<svg/);
  });

  it("marks only unbordered image layout tables for mobile stacking", () => {
    const content = `<table><tr><td>Overview</td><td>&nbsp;</td><td><img src="/fan.png"></td></tr></table>`;
    const body = parse(normalizeWordHtml(content + '<table border="1"><tr><td>Value</td><td><img src="/fan.png"></td></tr></table>' + '<table><tr><td>Flow</td><td>1400</td></tr></table>').html);
    expect(body.querySelectorAll('.word-table--layout')).toHaveLength(1);
    expect(body.querySelectorAll('.word-spacer')).toHaveLength(1);
    expect(body.querySelectorAll('.word-table--bordered')).toHaveLength(1);
    expect(body.querySelectorAll('table')).toHaveLength(3);
  });
});
