import {
  IdentifierExpression,
  LiteralPropertyName,
  PropertyNameAssignment,
  CallExpression,
  ExpressionStatement,
  EnsureStatement,
  RequireStatement
  } from '../syntax/trees/ParseTrees.js';
import {
  createIfStatement,
  createThrowStatement,
  createNewExpression,
  createIdentifierExpression,
  createArgumentList,
  createBlock,
  createEmptyBlock,
  createUnaryExpression,
  createOperatorToken,
  createStringLiteral,
  createParenExpression,
  createExpressionStatement,
  createCallStatement,
  createFunctionExpression,
  createEmptyParameterList,
  createImmediatelyInvokedFunctionExpression,
  createReturnStatement,
  createAssignmentStatement,
  createVariableDeclarationList,
  createVariableStatement,
  createFunctionBody
  } from './ParseTreeFactory.js';
import {  BANG,LET  } from '../syntax/TokenType.js';
import {  ParseTreeWriter  } from '../outputgeneration/ParseTreeWriter.js';
import {ParseTreeTransformer} from './ParseTreeTransformer.js';

export class ConditionTransformer extends ParseTreeTransformer {

  transformFunctionDeclaration(tree) {
    tree.body.statements = createTargetStatements(...separateSourceStatements(tree.body.statements));
    return tree;

    function separateSourceStatements(statements) {
      var require, ensure;
      let body = [];
      for (let st of statements) {
        if (st instanceof RequireStatement) {
          require = st;
        } else if (st instanceof EnsureStatement) {
          ensure = st;
        } else {
          body.push(st);
        }
      }
      return [require, ensure, body];
    }

    function createTargetStatements(require, ensure, body) {
      let checkRequire = createCheckBlock('Precondition', require);
      if (!ensure) {
        return [checkRequire, createBlock(body)];
      }
      let callBody = createImmediatelyInvokedFunctionExpression(createFunctionBody(body)),
        resultVar = createIdentifierExpression('$result'),
        assignResult = createVariableStatement(createVariableDeclarationList(LET, resultVar, callBody)),
        checkEnsure = createCheckBlock('Postcondition', ensure),
        returnResult = createReturnStatement(resultVar);
      return [checkRequire, assignResult, checkEnsure, returnResult];
    }

    function createCheckBlock(name, statement) {
      if (!statement) {
        return createEmptyBlock();
      }
      let checks = [];
      for (let arg of statement.args.args) {
        let writer = new ParseTreeWriter();
        writer.visitAny(arg);
        checks.push(createIfStatement(createUnaryExpression(createOperatorToken(BANG), createParenExpression(arg)),
          createThrowStatement(createNewExpression(
            createIdentifierExpression('Error'), createArgumentList([createStringLiteral(name + ' violated: ' + writer.toString())])))));
      }
      return createBlock(checks);
    }
  }
}
