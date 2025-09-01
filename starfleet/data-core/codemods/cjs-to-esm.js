/**
 * JSCodeshift transformer to convert CommonJS to ESM
 * Handles module.exports, require(), and adds .js extensions
 */

module.exports = function transformer(fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);
  let hasChanges = false;

  // 1. Convert require() to import
  root
    .find(j.VariableDeclarator, {
      init: {
        type: 'CallExpression',
        callee: { name: 'require' }
      }
    })
    .forEach((path) => {
      const requirePath = path.value.init.arguments[0].value;
      const id = path.value.id;

      // Skip dynamic requires
      if (typeof requirePath !== 'string') {
        console.log(`FIXME: Dynamic require in ${fileInfo.path}`);
        return;
      }

      // Handle destructuring: const { a, b } = require('x')
      if (id.type === 'ObjectPattern') {
        const specifiers = id.properties.map((prop) =>
          j.importSpecifier(j.identifier(prop.key.name), j.identifier(prop.value.name))
        );

        const importDecl = j.importDeclaration(specifiers, j.literal(addJsExtension(requirePath)));

        j(path.parent).replaceWith(importDecl);
        hasChanges = true;
      }
      // Handle default: const x = require('y')
      else {
        const importDecl = j.importDeclaration(
          [j.importDefaultSpecifier(id)],
          j.literal(addJsExtension(requirePath))
        );

        j(path.parent).replaceWith(importDecl);
        hasChanges = true;
      }
    });

  // 2. Convert module.exports = X to export default X
  root
    .find(j.AssignmentExpression, {
      left: {
        type: 'MemberExpression',
        object: { name: 'module' },
        property: { name: 'exports' }
      }
    })
    .forEach((path) => {
      const exportValue = path.value.right;

      // Handle module.exports = { a, b }
      if (exportValue.type === 'ObjectExpression') {
        const namedExports = exportValue.properties.map((prop) => {
          // Handle shorthand: { TestRequirementAnalyzer }
          if (prop.shorthand) {
            return j.exportNamedDeclaration(null, [j.exportSpecifier(j.identifier(prop.key.name))]);
          }
          // Handle regular: { a: b }
          return j.exportNamedDeclaration(
            j.variableDeclaration('const', [
              j.variableDeclarator(j.identifier(prop.key.name), prop.value)
            ])
          );
        });

        // Replace with multiple export statements
        const parent = path.parent;
        if (parent.type === 'ExpressionStatement') {
          j(parent).replaceWith(namedExports);
        }
      } else {
        // Simple export default
        j(path.parent).replaceWith(j.exportDefaultDeclaration(exportValue));
      }
      hasChanges = true;
    });

  // 3. Convert exports.foo = bar to export const foo = bar
  root
    .find(j.AssignmentExpression, {
      left: {
        type: 'MemberExpression',
        object: { name: 'exports' }
      }
    })
    .forEach((path) => {
      const propName = path.value.left.property.name;
      const exportValue = path.value.right;

      j(path.parent).replaceWith(
        j.exportNamedDeclaration(
          j.variableDeclaration('const', [
            j.variableDeclarator(j.identifier(propName), exportValue)
          ])
        )
      );
      hasChanges = true;
    });

  // Helper to add .js extension to relative imports
  function addJsExtension(importPath) {
    // Skip node modules and already has extension
    if (!importPath.startsWith('.') || importPath.endsWith('.js')) {
      return importPath;
    }
    return importPath + '.js';
  }

  return hasChanges ? root.toSource() : null;
};
