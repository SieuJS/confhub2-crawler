/* eslint-disable no-console */
// eslint-disable-next-line import/no-extraneous-dependencies
import { parse} from 'node-html-parser';

import { Browser, Page } from 'playwright';
import { ConferenceData } from '../model';


interface ClickableElement {
  url: string | null;
  tag: string | null;
  element: string | null;
}

export const saveHTMLContent = async (browserContext : Browser, conference : ConferenceData, links : string[]) => {
    try {
      for (let i = 0; i < links.length; i++) {
        const page = await browserContext.newPage();
        try {
          // Timeout nếu trang tải quá lâu
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 45000)
          );
          await Promise.race([page.goto(links[i], { waitUntil: 'domcontentloaded' }), timeoutPromise]);
          // Lấy nội dung HTML
          const htmlContent = await page.content();
          // Xử lý nội dung HTML
          const document = cleanDOM(htmlContent);
          let fullText = traverseNodes(document);
          fullText = removeExtraEmptyLines(fullText);
          const cfp = await saveHTMLFromCallForPapers(page);
          const imp = await saveHTMLFromImportantDates(page);
          let finalContent = '';
          finalContent = `${fullText  }\nCall for papers data: \n${  cfp
           }Important dates data: \n${  imp}`;
          return {
            conferenceName: conference.name,
            conferenceacronym: conference.acronym,
            conferenceIndex: i,
            conferenceLink: links[i],
            conferenceText: `Conference ${conference.acronym}_${i}:\n${finalContent.trim()}`
          };

        } catch (error) {
          // console.error(`Error loading page ${links[i]}: ${error.message}`);
        } finally {
          await page.close();
        }
      }
    } catch (error) {
      // console.error('Error in saveHTMLContent:', error);
    }
  };

  const cleanDOM = (htmlContent : string) : HTMLElement=> {
    try {
      const document = parse(htmlContent);
      // Loại bỏ tất cả các thẻ <script> và <style>
      const scripts = document.querySelectorAll('script');
      scripts.forEach(script => script.remove());
      const styles = document.querySelectorAll('style');
      styles.forEach(style => style.remove());
      const result = document.querySelector('body') as unknown as HTMLElement;
      return result;
    } catch (error) {
      console.log(error);
      throw new Error('Error parsing HTML content');
    }

  };

  const normalizeTextNode = (text : string)  => {
    // Loại bỏ dấu xuống dòng không cần thiết giữa các từ mà không có dấu câu
    let newText = text;
    newText = newText.replace(/([a-zA-Z0-9]),?\n\s*([a-zA-Z0-9])/g, '$1 $2');

    // Loại bỏ dấu xuống dòng không có dấu ngắt câu phía trước (dấu chấm, dấu chấm hỏi, dấu chấm than)
    newText = newText.replace(/([^\.\?\!])\n\s*/g, '$1 ');

    // Chuẩn hóa khoảng trắng dư thừa
    newText = newText.replace(/\s+/g, ' ');

    return newText.trim();
  };


  const traverseNodes = (node : HTMLElement) => {
    let text = '';
    if (node.nodeType === 3) { // Text node
      const trimmedText = normalizeTextNode(node.textContent as string);
      if (trimmedText) {
        text += `${trimmedText} `;
      }
    } else if (node.nodeType === 1) { // Element node
      const tagName = node.tagName.toLowerCase();

      if (tagName === 'table') {
        text += processTable(node as HTMLTableElement);
      } else if (tagName === 'li') {
        const childrenText : string[] = [];

        node.childNodes.forEach((child : HTMLElement) => {
          const childText = traverseNodes(child).trim();
          if (childText) { // Chỉ xử lý khi có nội dung trong thẻ con
            childrenText.push(childText); // Lưu lại các thẻ con của <li>
          }
        });

        if (childrenText.length > 0) {
          text += `${childrenText.join(' | ')  } \n `; // Ngăn cách giữa các thẻ con bằng '|'
        }
      } else if (tagName === 'br') {
        text += ' \n '; // Thêm dấu xuống dòng khi gặp thẻ <br>
      } else {
        node.childNodes.forEach((child : HTMLElement) => {
          text += traverseNodes(child); // Đệ quy xử lý các phần tử con
        });

        // Nếu là <ul> hoặc <ol>, chỉ xử lý khi không có <li> đã được xử lý
        if (tagName === 'ul' || tagName === 'ol') {
          const liElements = node.querySelectorAll('li');
          if (liElements.length === 0) {
            text += processList(node); // Xử lý danh sách nếu không có thẻ <li>
          }
        }
      }
      // Kiểm tra block-level tags và xử lý xuống dòng
      const blockLevelTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'section', 'article', 'header', 'footer', 'aside', 'nav', 'main'];

      if (!blockLevelTags.includes(tagName) && tagName !== 'table' && tagName !== 'ul' && tagName !== 'ol') {
        text += ' '; // Thêm dấu cách nếu không phải block-level hoặc bảng
      }

      if (blockLevelTags.includes(tagName) || (tagName === 'div' && node.closest('li') === null)) {
        text += ' \n '; // Xuống dòng cho các thẻ block-level
      }
    }

    return text;
  };


  const processTable = (table : HTMLTableElement) => {
    let tableText = '';
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return tableText;

    rows.forEach((row : HTMLTableRowElement, rowIndex: number) => {
      const cells = row.querySelectorAll('td, th');
      if (rowIndex === 0) {
        tableText += ' \n '; // Thêm dòng mới trước dòng đầu tiên
      }
      let rowText = '';
      cells.forEach((cell : HTMLTableCellElement, index : number) => {
        const cellText = traverseNodes(cell).trim(); // Gọi hàm traverseNodes để duyệt qua các thẻ con trong td/th
        if (cellText) { // Chỉ xử lý khi có nội dung trong thẻ td/th
          if (index === cells.length - 1) {
            rowText += cellText; // Không thêm dấu ngăn cách cho ô cuối cùng
          } else {
            rowText += `${cellText  } | `; // Thêm dấu ngăn cách giữa các ô
          }
        }
      });
      if (rowText.trim()) { // Chỉ thêm dòng nếu có nội dung
        tableText += `${rowText  } \n `; // Thêm dấu xuống dòng sau mỗi hàng
      }
    });

    return `${tableText  } \n `; // Ngăn cách giữa các bảng
  };


  const removeExtraEmptyLines = (text : string) : string => text.replace(/\n\s*\n\s*\n/g, '\n\n');

  const saveHTMLFromImportantDates = async (page : Page) => {
    try {
      const tabs = [
        'importantdates',
        'dates',
      ];

      const clickableElements = await page.$$eval('a', (els : HTMLAnchorElement[]) : ClickableElement[] => els.map((el : HTMLAnchorElement) : ClickableElement => ({
          url: el.href.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          element: el.outerHTML
        })));
      const importantDatesLinks = [];
      for (const tab of tabs) {
        // Tạo biểu thức chính quy để tìm từ khóa chính xác
        const regex = new RegExp(`\\b${tab}\\b`, 'i');  // '\\b' là giới hạn từ (word boundary), 'i' là không phân biệt hoa thường
        const matchedElement = clickableElements.find((el : ClickableElement) => regex.test(el.url as string));
        if (matchedElement) {
          // Tạo URL đầy đủ nếu cần thiết (trường hợp là relative URL)
          const fullUrl = new URL(matchedElement.url as string, page.url()).href;
          // Chuyển hướng tới trang của tab Call for Papers
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          const currentURL = page.url(); // Đảm bảo đây là URL mới
          importantDatesLinks.push(currentURL);
          const htmlContent = await page.content();
          // Xử lý nội dung HTML
          const document = cleanDOM(htmlContent);
          let fullText = traverseNodes(document);
          fullText = removeExtraEmptyLines(fullText);
          return fullText;
        }
      }
        // Nếu không tìm thấy tab nào phù hợp
      }
      catch (error) {
        console.log('\nError in saveHTMLFromImportantDates:', error);
      }
      return '';
  };

  const processList = (list : HTMLElement) => {
    let listText = '';
    list.querySelectorAll('li').forEach((li : HTMLLIElement) => {
      const liText = traverseNodes(li).trim();
      if (liText) { // Chỉ xử lý khi có nội dung trong thẻ li
        listText += `${liText  } \n `;
      }
    });
    return `${listText  } \n `;
  };


  const saveHTMLFromCallForPapers = async (page : Page) => {
    try {
      const tabs = [
        'cfp',
        'paper',
        'call',
        'research',
        'track'
      ];

      const clickableElements = await page.$$eval('a', (els : HTMLAnchorElement[])  : ClickableElement[]=> els.map((el : HTMLAnchorElement) : ClickableElement => ({
          url: el.href.toLowerCase(),
          tag: el.tagName.toLowerCase(),
          element: el.outerHTML
        })));
      // Tạo mảng để lưu các đường link Call for Papers
      const cfpLinks = [];

      for (const tab of tabs) {
        const matchedElement = clickableElements.find((el : ClickableElement) : boolean | undefined => el.url?.includes(tab.toLowerCase()));

        if (matchedElement && matchedElement.url) {

          const fullUrl = new URL(matchedElement.url, page.url()).href;

          // Chuyển hướng tới trang của tab Call for Papers
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

          // Lấy URL của trang hiện tại sau khi nhấp vào tab Call for Papers
          const currentURL = page.url();
          cfpLinks.push(currentURL);  // Lưu URL vào mảng cfpLinks

          // Lấy nội dung từ tất cả các phần tử có chứa thuộc tính 'main'
          let mainContent = await page.$$eval('*', (els : HTMLElement[]) => els
              .filter((el : HTMLElement) => Array.from(el.attributes).some( ( attr : Attr ) => attr.name.toLowerCase().includes('main')))
              .map((el : HTMLElement) => el.outerHTML)
              .join('\n\n'));

          if (!mainContent) {
            mainContent = await page.content() ;
          }
          const document = cleanDOM(mainContent);
          let fullText = traverseNodes(document);
          fullText = removeExtraEmptyLines(fullText);

          return fullText;
        }
      }

      return '';

    } catch (error) {
      // console.log('\nError in saveHTMLFromCallForPapers:', error);
    }
  };
