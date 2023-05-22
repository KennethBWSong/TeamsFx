import path from 'path';
import fs from 'fs-extra';
import { OpenAPIV3 } from 'openapi-types';
import prettier from 'prettier';

export function getVersion(): string {
  const pkgPath = path.resolve(__dirname, '..', 'package.json');
  const pkgContent = fs.readJsonSync(pkgPath);
  return pkgContent.version;
}



export async function isFolderEmpty(folderPath: string): Promise<boolean> {
  const files = await fs.readdir(folderPath);
  return files.length === 0;
}

export function getSafeCardName(
  api: OpenAPIV3.OperationObject,
  url: string,
  operation: string
): string {
  let name = api.operationId || api.summary || operation + url;
  name = name.replace(/[{}]/g, '');
  const wordArr = name.split(/[ /.-]/g);
  let safeName = wordArr[0];
  for (let i = 1; i < wordArr.length; i++) {
    safeName += wordArr[i].charAt(0).toUpperCase() + wordArr[i].slice(1);
  }
  safeName = safeName.charAt(0).toLowerCase() + safeName.slice(1);
  if (safeName.match(/^\d+/)) {
    safeName = `_${safeName}`;
  }
  return safeName;
}

export function wrapperCard(
  body: any,
  adaptiveCardName: string,
  operation: string | undefined = undefined
): any {
  const fullCard = {
    type: 'AdaptiveCard',
    body,
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5'
  } as any;

  if (operation) {
    fullCard.actions = [
      {
        type: 'Action.Execute',
        verb: adaptiveCardName,
        title: `${operation.toUpperCase()}`
      }
    ];
  }

  return fullCard;
}

export function getCardTitle(
  operation: string,
  url: string,
  summary: string | undefined = undefined
) {
  return {
    type: 'TextBlock',
    text: `${operation.toUpperCase()} ${url}: ${summary ?? ''}`,
    wrap: true
  };
}

export function formatCode(code: string): string {
  const formattedCode = prettier.format(code, {
    parser: 'typescript',
    semi: true,
    singleQuote: true,
    trailingComma: 'all',
    arrowParens: 'always',
    printWidth: 80,
    tabWidth: 2
  });
  return formattedCode;
}

export function getResponseJsonResult(
  operationObject: OpenAPIV3.OperationObject
): OpenAPIV3.MediaTypeObject {
  let jsonResult =
    (operationObject?.responses?.['200'] as OpenAPIV3.ResponseObject)
      ?.content?.['application/json'] ??
    (operationObject?.responses?.['201'] as OpenAPIV3.ResponseObject)
      ?.content?.['application/json'] ??
    (operationObject?.responses?.default as OpenAPIV3.ResponseObject)
      ?.content?.['application/json'];

  if (!jsonResult) {
    jsonResult = {};
  }

  return jsonResult;
}

export function componentRefToName(ref: string): string {
  const refArr = ref.split('/');
  return refArr[refArr.length - 1];
}

export function capitalizeFirstLetter(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
