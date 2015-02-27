import {PropertyMethodAssignment} from '../syntax/trees/ParseTrees.js';
import {
  createEmptyParameterList,
  createFunctionBody,
  createLiteralPropertyName
  } from './ParseTreeFactory.js';
import {ParseTreeTransformer} from './ParseTreeTransformer.js';
import {ConditionTransformer} from './ConditionTransformer.js';

export class InvariantsTransformer extends ParseTreeTransformer {

  transformPropertyMethodAssignment(tree) {
    tree = super.transformPropertyMethodAssignment(tree);
    tree.body.wasPma = true;
    return tree;
  }

  transformInvariantStatement(tree) {
    tree = new PropertyMethodAssignment(tree.location, false, null, createLiteralPropertyName('$invariants'), createEmptyParameterList(),
      null, [], createFunctionBody(new ConditionTransformer().createCheckStatements('Invariant', tree), 1), null);
    return tree;
  }
}
