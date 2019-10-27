const puppeteer = require("puppeteer");

// CEI html selectors
const BROKER_SELECTOR = "#ctl00_ContentPlaceHolder1_ddlAgentes";
const SEARCH_BTN_SELECTOR = "#ctl00_ContentPlaceHolder1_btnConsultar";
const HEAD_TABLE_SELECTOR =
  "#ctl00_ContentPlaceHolder1_rptAgenteBolsa_ctl00_rptContaBolsa_ctl00_pnAtivosNegociados > div > div > section > div > table > thead > tr > th";
const BODY_TABLE_SELECTOR =
  "#ctl00_ContentPlaceHolder1_rptAgenteBolsa_ctl00_rptContaBolsa_ctl00_pnAtivosNegociados > div > div > section > div > table > tbody > tr";

const extractTransactions = async (username, password, filter = "") => {
  let extractionData = [];

  const browser = await puppeteer.launch({ headless: false });
  try {
    const page = await browser.newPage();

    // for log and better network/loading performance
    await page.setRequestInterception(true);
    page.on("request", req => {
      if (
        req.resourceType() == "stylesheet" ||
        req.resourceType() == "font" ||
        req.resourceType() == "image"
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // do auth
    console.log("Authenticating...");
    await page.goto("https://cei.b3.com.br/CEI_Responsivo/");
    await page.waitForSelector("#ctl00_ContentPlaceHolder1_txtLogin");
    await page.click("#ctl00_ContentPlaceHolder1_txtLogin");
    await page.keyboard.type(username);
    await page.click("#ctl00_ContentPlaceHolder1_txtSenha");
    await page.keyboard.type(password);
    await page.click("#ctl00_ContentPlaceHolder1_btnLogar");
    await page.waitForSelector("#ctl00_Breadcrumbs_lblTituloPagina");

    // nagivate to negociations and waiting for DOM load
    await page.goto(
      "https://cei.b3.com.br/CEI_Responsivo/negociacao-de-ativos.aspx"
    );
    await page.waitForSelector(BROKER_SELECTOR);

    // extract brokers ids
    let brokers = await page.evaluate(selector => {
      return Array.prototype.map.call(
        document.querySelector(selector).children,
        el => ({ id: el.value, name: el.textContent.trim() })
      );
    }, BROKER_SELECTOR);

    if (filter != "") {
      brokers = brokers.filter(value => {
        return value["id"] == "-1" || filter.split(",").includes(value["id"]);
      });
    }

    // extract information of each broker with one single account
    for (let index = 1; index < brokers.length; index++) {
      console.log(`Fetching broker ${index}...`);
      const brokerId = brokers[index].id;

      await page.select(BROKER_SELECTOR, brokerId);
      await page.waitForResponse(
        "https://cei.b3.com.br/CEI_Responsivo/negociacao-de-ativos.aspx"
      );
      await page.click(SEARCH_BTN_SELECTOR);
      await page.waitForResponse(
        "https://cei.b3.com.br/CEI_Responsivo/negociacao-de-ativos.aspx"
      );

      await page.waitFor(BODY_TABLE_SELECTOR, { timeout: 30 * 1000 });

      if (index == 1) {
        header = await page.evaluate(selector => {
          return Array.prototype.map.call(
            document.querySelectorAll(selector),
            el => el.textContent.trim()
          );
        }, HEAD_TABLE_SELECTOR);
      }

      var rows = await page.evaluate(selector => {
        return Array.prototype.map.call(
          document.querySelectorAll(selector),
          el =>
            Array.prototype.map.call(
              el.children,
              subEl => (subEl && subEl.textContent.trim()) || ""
            )
        );
      }, BODY_TABLE_SELECTOR);

      rows.forEach(row => {
        row.push(brokers[index].name);
        extractionData.push(row);
      });

      await page.click(SEARCH_BTN_SELECTOR);
      await page.waitForResponse(
        "https://cei.b3.com.br/CEI_Responsivo/negociacao-de-ativos.aspx"
      );
    }

    await browser.close();
    return extractionData;
  } catch (error) {
    // await browser.close();
    throw error;
  }
};

module.exports.extractTransactions = extractTransactions;
