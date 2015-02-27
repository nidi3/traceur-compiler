import {
  IdentifierExpression,
  LiteralPropertyName,
  PropertyNameAssignment,
  CallExpression,
  ExpressionStatement,
  EnsureStatement,
  RequireStatement,
  PropertyVariableDeclaration,
  PropertyMethodAssignment
  } from '../syntax/trees/ParseTrees.js';
import{  FUNCTION_EXPRESSION} from '../syntax/trees/ParseTreeType.js';
import {
  createIfStatement,
  createThrowStatement,
  createNewExpression,
  createIdentifierExpression,
  createIdentifierToken,
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
  createFunctionBody,
  createBinaryExpression,
  createMemberExpression,
  createThisExpression,
  createCallExpression,
  createScopedExpression,
  createLiteralPropertyName
  } from './ParseTreeFactory.js';
import {  BANG,LET,VAR,EQUAL_EQUAL_EQUAL,TYPEOF,AND  } from '../syntax/TokenType.js';
import {  ParseTreeWriter  } from '../outputgeneration/ParseTreeWriter.js';
import {ParseTreeTransformer} from './ParseTreeTransformer.js';
import {ConditionTransformer} from './ConditionTransformer.js';

export class InvariantsTransformer extends ParseTreeTransformer {

  transformPropertyMethodAssignment(tree) {
    tree = super.transformPropertyMethodAssignment(tree);
    tree.body.wasPma = true;
    return tree;
  }

  transformInvariantsStatement(tree) {
    tree = new PropertyMethodAssignment(tree.location, false, null, createLiteralPropertyName('$invariants'), createEmptyParameterList(),
      null, [], createFunctionBody(new ConditionTransformer().createCheckStatements('Invariant', tree), 1), null);
    return tree;
  }
}
