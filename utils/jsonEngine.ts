import type { UIComponent } from '@/types';

/**
 * Serialize the component tree to the Pega Constellation-inspired JSON schema.
 * Children are recursively serialized.
 */
export function serializeTree(components: UIComponent[]): object[] {
  return components.map(serializeNode);
}

function serializeNode(component: UIComponent): object {
  const node: Record<string, unknown> = {
    id: component.id,
    type: component.type,
    props: component.props,
  };

  if (component.children.length > 0) {
    node.children = component.children.map(serializeNode);
  }

  return node;
}

/**
 * Parse a JSON array back into a UIComponent tree.
 * Validates structure and assigns empty children arrays where missing.
 */
export function deserializeTree(json: unknown): UIComponent[] {
  if (!Array.isArray(json)) {
    throw new Error('Root JSON must be an array of components.');
  }
  return json.map(deserializeNode);
}

function deserializeNode(raw: unknown): UIComponent {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Each component must be a non-null object.');
  }
  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || !obj.id) {
    throw new Error('Component must have a string id.');
  }
  if (typeof obj.type !== 'string') {
    throw new Error('Component must have a string type.');
  }
  if (typeof obj.props !== 'object' || obj.props === null) {
    throw new Error(`Component "${obj.id}" must have a props object.`);
  }

  return {
    id: obj.id,
    type: obj.type as UIComponent['type'],
    props: obj.props as UIComponent['props'],
    children: Array.isArray(obj.children)
      ? (obj.children as unknown[]).map(deserializeNode)
      : [],
  };
}

/**
 * Pretty-print the component tree as JSON string.
 */
export function treeToJSON(components: UIComponent[]): string {
  return JSON.stringify(serializeTree(components), null, 2);
}

/**
 * Parse JSON string and return a UIComponent tree.
 * Throws on invalid JSON or invalid schema.
 */
export function jsonToTree(jsonString: string): UIComponent[] {
  const parsed = JSON.parse(jsonString);
  return deserializeTree(parsed);
}
