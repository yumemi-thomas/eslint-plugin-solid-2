declare module "is-html" {
  export default function isHtml(value: string): boolean;
}

declare module "kebab-case" {
  export default function kebabCase(value: string): string;
}

declare module "style-to-object" {
  export default function parse(value: string): Record<string, string> | null;
}
