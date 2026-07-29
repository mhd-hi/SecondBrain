import { createSwaggerSpec } from 'next-swagger-doc';
import YAML from 'yaml';

export const isSwaggerEnabled = process.env.NODE_ENV !== 'production';

// `swagger-jsdoc@6` expects an older `yaml` API with `defaultOptions`.
// Our lockfile resolves a newer `yaml` release, so provide the missing bag
// before `createSwaggerSpec()` triggers swagger-jsdoc's parser setup.
if (!('defaultOptions' in YAML) || !YAML.defaultOptions) {
  Object.assign(YAML, { defaultOptions: {} });
}

const originalParseDocument = YAML.parseDocument.bind(YAML);
type ParseDocumentOptions = Parameters<typeof YAML.parseDocument>[1];

YAML.parseDocument = ((source: string, options?: ParseDocumentOptions) => {
  const document = originalParseDocument(source, options);

  if (!('anchors' in document) || !document.anchors) {
    Object.assign(document, {
      anchors: {
        getNames: () => [] as string[],
      },
    });
  }

  if (!('cstNode' in document) || !document.cstNode) {
    Object.assign(document, {
      cstNode: {
        toString: () => source,
      },
    });
  }

  return document;
}) as typeof YAML.parseDocument;

// Scans JSDoc `@swagger` comments under src/app/api and builds paths
// from the actual route files — nothing here is hardcoded per-route.
export const getApiDocs = () =>
  createSwaggerSpec({
    apiFolder: 'src/app/api',
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Second Brain API',
        version: '1.0.0',
      },
      components: {
        securitySchemes: {
          sessionAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'authjs.session-token',
          },
        },
      },
      security: [{ sessionAuth: [] }],
    },
  });
