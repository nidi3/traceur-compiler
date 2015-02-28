import {
  IdentifierExpression,
  LiteralPropertyName,
  PropertyNameAssignment,
  CallExpression,
  ExpressionStatement,
  EnsureStatement,
  RequireStatement,
  ThisExpression,
  MemberExpression,
  } from '../syntax/trees/ParseTrees.js';
import{  FUNCTION_EXPRESSION,FOR_STATEMENT,ARRAY_LITERAL_EXPRESSION,MEMBER_EXPRESSION,IDENTIFIER_EXPRESSION} from '../syntax/trees/ParseTreeType.js';
import {  BANG,LET,VAR,EQUAL_EQUAL_EQUAL,TYPEOF,AND,IDENTIFIER,THIS  } from '../syntax/TokenType.js';
import {IdentifierToken} from '../syntax/IdentifierToken.js';
import {ParseTreeVisitor} from '../syntax/ParseTreeVisitor.js';

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
  createObjectLiteral,
  createObjectLiteralExpression,
  createPropertyNameAssignment,
  createLiteralPropertyName,
  } from './ParseTreeFactory.js';
import {  ParseTreeWriter  } from '../outputgeneration/ParseTreeWriter.js';
import {ParseTreeTransformer} from './ParseTreeTransformer.js';

export class ConditionTransformer extends ParseTreeTransformer {

  transformFunctionBody(tree) {
    tree = super.transformFunctionBody(tree);
    tree.statements = this.createTargetStatements_(tree.wasPma, ...this.separateSourceStatements_(tree.statements));
    return tree;
  }

  separateSourceStatements_(statements) {
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

  moveRestArgumentsUp_(body, res) {
    let init = body[0].initializer;
    if (body[0].type === FOR_STATEMENT && init && init.declarations.length === 2 &&
      init.declarations[0].initializer.type === ARRAY_LITERAL_EXPRESSION && init.declarations[0].initializer.elements.length === 0) {
      res.push(body[0]);
      body.splice(0, 1);
    }
  }

  createTargetStatements_(wasPma, require, ensure, body) {
    if (body.length == 0) {
      return body;
    }

    let res = [];
    this.moveRestArgumentsUp_(body, res);

    if (ensure) {
      let orf = new OldReferenceFinder();
      for (let e of ensure.args.args) {
        orf.visitAny(e);
      }
      let old = orf.getObjectLiteral();
      if (old.propertyNameAndValues.length > 0) {
        res.push(createVariableStatement(createVariableDeclarationList(VAR, createIdentifierExpression('$old'), old)));
      }
    }
    if (require) {
      res.push(createBlock(this.createCheckStatements('Precondition', require)));
    }
    if (!ensure && !wasPma) {
      res.push(createBlock(body));
    } else {
      let renamer = new ArgumentsRenamer(),
        callBody = createScopedExpression(renamer.transformAny(createFunctionBody(body, 0)), createThisExpression()),
        resultVar = createIdentifierExpression('$result'),
        assignResult = createVariableStatement(createVariableDeclarationList(VAR, resultVar, callBody));

      if (renamer.hasChange) {
        res.push(createVariableStatement(createVariableDeclarationList(VAR, createIdentifierExpression('$arguments'), createIdentifierExpression('arguments'))));
      }

      res.push(assignResult);

      if (ensure) {
        res.push(createBlock(this.createCheckStatements('Postcondition', ensure)));
      }

      if (wasPma) {
        let thisInvariants = createMemberExpression(createThisExpression(), createIdentifierToken('$invariants')),
          invariantsIsFunc = createBinaryExpression(
            createUnaryExpression(createOperatorToken(TYPEOF), thisInvariants),
            createOperatorToken(EQUAL_EQUAL_EQUAL),
            createStringLiteral('function')),
          shouldCallInvariants = createBinaryExpression(createThisExpression(), createOperatorToken(AND), invariantsIsFunc),
          checkInvariants = createIfStatement(shouldCallInvariants, createCallStatement(thisInvariants));
        res.push(checkInvariants);
      }

      res.push(createReturnStatement(resultVar));
    }

    return res;
  }

  createCheckStatements(name, statement) {
    let checks = [];
    for (let arg of statement.args.args) {
      let writer = new ParseTreeWriter();
      writer.visitAny(arg);
      checks.push(createIfStatement(createUnaryExpression(createOperatorToken(BANG), createParenExpression(arg)),
        createThrowStatement(createNewExpression(
          createIdentifierExpression('Error'), createArgumentList([createStringLiteral(name + ' violated: ' + writer.toString())])))));
    }
    return checks;
  }
}

//TODO use AlphaRenamer
class ArgumentsRenamer extends ParseTreeTransformer {
  constructor() {
    this.level = 0;
    this.changed = false;
  }

  get hasChange() {
    return this.changed;
  }

  transformFunctionBody(tree) {
    this.level++;
    tree = super.transformFunctionBody(tree);
    this.level--;
    return tree;
  }

  transformIdentifierExpression(tree) {
    if (this.level == 1 && tree.identifierToken.value === 'arguments') {
      tree = createIdentifierExpression('$arguments');
      this.changed = true;
    }
    return tree;
  }
}

class OldReferenceFinder extends ParseTreeVisitor {
  constructor() {
    this.refs_ = {};
  }

  visitMemberExpression(tree) {
    let lin = this.linearize_(tree);
    if (lin && lin[0] === '$old') {
      this.addRef_(lin.slice(1));
    }
  }

  addRef_(list) {
    var r = this.refs_;
    var i = 0;
    for (; i < list.length - 1; i++) {
      let elem = list[i];
      if (!r[elem]) {
        r[elem] = {};
      }
      r = r[elem];
    }
    r[list[i]] = list.length === 1 ? this.createIdentifierExpression_(list[0]) : this.createMemberExpression_.apply(this, list);
  }

  createIdentifierExpression_(name) {
    return name === THIS ? new ThisExpression(null) : new IdentifierExpression(null, name);
  }

  createMemberExpression_(operand, memberName, memberNames) {
    if (typeof operand === 'string' || operand instanceof IdentifierToken)
      operand = this.createIdentifierExpression_(operand);
    if (typeof memberName === 'string')
      memberName = createIdentifierToken(memberName);
    let tree = new MemberExpression(null, operand, memberName);
    for (let i = 2; i < arguments.length; i++) {
      tree = this.createMemberExpression_(tree, arguments[i]);
    }
    return tree;
  }

  getObjectLiteral() {
    function objectLiteral(obj) {
      let ass = [];
      for (let name in obj) {
        let value = obj[name];
        let v = value.type ? value : objectLiteral(value);
        ass.push(createPropertyNameAssignment(createLiteralPropertyName(name), v));
      }
      return createObjectLiteralExpression(ass);
    }

    return objectLiteral(this.refs_);
  }

  linearize_(tree) {
    let idents = [];
    var t = tree;
    while (t.type === MEMBER_EXPRESSION) {
      if (t.memberName.type !== IDENTIFIER) {
        return null;
      }
      idents.unshift(t.memberName.value);
      t = t.operand;
    }
    if (t.type !== IDENTIFIER_EXPRESSION) {
      return null;
    }
    idents.unshift(t.identifierToken.value);
    return idents;
  }
}

