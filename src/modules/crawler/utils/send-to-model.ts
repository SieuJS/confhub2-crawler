/* eslint-disable max-len */
import {GoogleGenerativeAI} from '@google/generative-ai';
import { parse } from 'csv-parse';
import * as fs from 'fs';
const apiKey = 'AIzaSyAV319MCiDorKNeNykl68MAzlIJk6YRz3g';
const genAI = new GoogleGenerativeAI(apiKey);
import { join } from 'path';

const numberOfConferencesToCrawl = 2;

const systemInstruction = `
- Always return result exact format as my sample outputs provided, do not return result in json format
- Always return the final output_${numberOfConferencesToCrawl} containing the information of the 50 conferences provided in input_${numberOfConferencesToCrawl}, without returning any extra or missing conference and ensuring the correct conferences order as provided in input_${numberOfConferencesToCrawl}
- When returning results for any conference in output_${numberOfConferencesToCrawl}, only use the information provided for that conference in input_${numberOfConferencesToCrawl} to return result
- Make sure output_${numberOfConferencesToCrawl} returns the correct name, total number and order of conferences as in the list provided in input_${numberOfConferencesToCrawl}`;

const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-latest',
  systemInstruction,
});

const generationConfig = {
  temperature: 1,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 8192,
  responseMimeType: 'text/plain',
};
export const callGeminiAPI = async (conferencesText : string) => {
    const csvPath = join(process.cwd(), 'promt', 'geminiapi.csv');
      const {
        inputPart1,
        inputPart2,
        inputPart3,
        inputPart4,
        outputPart1,
        outputPart2,
        outputPart3,
        outputPart4,
      } = await readPromptCSV(csvPath) as {
        inputPart1: string;
        inputPart2: string;
        inputPart3: string;
        inputPart4: string;
        outputPart1: string;
        outputPart2: string;
        outputPart3: string;
        outputPart4: string;
      };

      const parts = [
        { text: `${inputPart1}` },
        { text: `${outputPart1}` },
        { text: `${inputPart2}` },
        { text: `${outputPart2}` },
        { text: `${inputPart3}` },
        { text: `${outputPart3}` },
        { text: `${inputPart4}` },
        { text: `${outputPart4}` },
        { text: `input_${numberOfConferencesToCrawl}: \n${conferencesText}` },
        { text: `output_${numberOfConferencesToCrawl}: ` },
      ];

    try {
        const response = await model.generateContent(
            {
                contents : [{
                    role : 'user',
                    parts
                }]
                ,
                generationConfig
            }
        );
        return response.response.text();
    } catch (error) {
        throw error;
    }
};

async function readPromptCSV(filePath: string) {
  return new Promise((resolve, reject) => {
    try {
      const allInputs: string[] = [];
      const allOutputs: string[] = [];

      fs.createReadStream(filePath)
        .pipe(parse({ columns: true }))
        .on('data', (row: { input: string; output: string }) => {
          const inputText: string = (row.input || '').trim();
          const outputText = (row.output || '').trim();
          if (inputText) allInputs.push(inputText);
          if (outputText) allOutputs.push(outputText);
        })
        .on('end', () => {
          // Lọc các input/output hợp lệ
          const validInputs = allInputs.filter((input) => input.trim() !== '');
          const validOutputs = allOutputs.filter((output) => output.trim() !== '');

          if (validInputs.length === 0 || validOutputs.length === 0) {
            reject(new Error('Không tìm thấy dữ liệu hợp lệ trong file CSV.'));
          }

          if (validInputs.length !== validOutputs.length) {
            reject(new Error('Số lượng input và output không khớp!'));
          }

          // Xác định số lượng phần tử mỗi phần tư
          const quarterLength = Math.ceil(validInputs.length / 4);

          // Hàm thêm số thứ tự mà không thay đổi cấu trúc của từng phần tử
          const addIndex = (array: string[]) =>
            array.length === 0
              ? [] // Nếu mảng rỗng, trả về mảng rỗng
              : array.map((item: string, idx: number) => `${idx + 1}. ${item}`); // Bắt đầu từ 1

          // Chia và thêm số thứ tự lại cho từng phần, mỗi phần reset chỉ mục
          const inputPart1 = addIndex(validInputs.slice(0, quarterLength)).join('\n');
          const inputPart2 = addIndex(validInputs.slice(quarterLength, quarterLength * 2)).join('\n');
          const inputPart3 = addIndex(validInputs.slice(quarterLength * 2, quarterLength * 3)).join('\n');
          const inputPart4 = addIndex(validInputs.slice(quarterLength * 3)).join('\n'); // Part 4

          const outputPart1 = addIndex(validOutputs.slice(0, quarterLength)).join('\n');
          const outputPart2 = addIndex(validOutputs.slice(quarterLength, quarterLength * 2)).join('\n');
          const outputPart3 = addIndex(validOutputs.slice(quarterLength * 2, quarterLength * 3)).join('\n');
          const outputPart4 = addIndex(validOutputs.slice(quarterLength * 3)).join('\n'); // Part 4

          resolve({
            inputPart1: `input: \n${inputPart1}`,
            inputPart2: `input: \n${inputPart2}`,
            inputPart3: `input: \n${inputPart3}`,
            inputPart4: `input: \n${inputPart4}`, // Part 4
            outputPart1: `output: \n${outputPart1}`,
            outputPart2: `output: \n${outputPart2}`,
            outputPart3: `output: \n${outputPart3}`,
            outputPart4: `output: \n${outputPart4}`, // Part 4
          });
        })
        .on('error', (error) => {
          reject(new Error(`Lỗi khi đọc file CSV: ${error.message}`));
        });
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      reject(new Error(`Lỗi khi xử lý file CSV: ${error.message}`));
    }
  });
}