import {ParseTreeTransformer} from './ParseTreeTransformer.js';
import {ScopeChainBuilderWithReferences} from '../semantics/ScopeChainBuilderWithReferences.js';
import{THIS} from '../syntax/PredefinedName.js';

class FreeVariableChecker extends ScopeChainBuilderWithReferences {
  constructor(reporter,pureness) {
    super(reporter);
    this.pureness_=pureness;
  }

  //overwrite parent implementation
  visitUnaryExpression(tree) {
    this.visitAny(tree.operand);
  }

  visitThisExpression(tree) {
    if (this.pureness_===2) {
      this.referenceFound(tree, THIS);
    }
  }

  //assume constructor functions not dependent of global state
  visitNewExpression(tree) {
    this.visitAny(tree.args);
  }

  //allow xxx.call(this,...)
  visitCallExpression(tree) {
    this.visitAny(tree.operand);
    let skipFirst = ((tree.operand.memberName === 'call' || tree.operand.memberName === 'apply') && tree.args.length > 0 && tree.args[0].type === THIS_EXPRESSION);
    for (let i = skipFirst ? 1 : 0; i < tree.args.length; i++) {
      this.visitAny(tree.args[i]);
    }
  }

  referenceFound(tree, name) {
    if (!this.scope.getBindingByName(name)) {
      let loc = tree.location;
      this.reporter.reportError(loc ? loc.start : '', `Free variable '${name}' is not allowed in pure function`);
      //console.log('undef',loc ? loc.start : '',name)
    }
  }
}

export class PureTransformer extends ParseTreeTransformer {
  constructor(identifierGenerator, reporter, options) {
    this.reporter_ = reporter;
  }

  transformFunctionDeclaration(tree) {
    tree = super.transformFunctionDeclaration(tree);
    if (tree.body.pureness) {
      new FreeVariableChecker(this.reporter_,tree.body.pureness).visitAny(tree);
    }
    return tree;
  }

  transformFunctionExpression(tree) {
    tree = super.transformFunctionExpression(tree);
    if (tree.body.pureness) {
      new FreeVariableChecker(this.reporter_,tree.body.pureness).visitAny(tree);
    }
    return tree;
  }

}
