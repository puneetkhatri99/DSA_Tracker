import hljs from 'highlight.js/lib/core';
import java from 'highlight.js/lib/languages/java';

hljs.registerLanguage('java', java); // the notes and your solutions are all Java

export { hljs };
export const javaHtml = (code: string) => hljs.highlight(code, { language: 'java' }).value;
