import test from 'node:test';
import assert from 'node:assert/strict';
import { STATIC_MOONEX_MODEL_CATALOG } from '../src/utils/modelPresentation';

test('client capability metadata matches the nine Moonex profile semantics', () => {
  const models = STATIC_MOONEX_MODEL_CATALOG.filter((model) => !model.isAuto);
  assert.equal(models.length, 9);

  for (const model of models) {
    if (model.id === 'moonex-research-1.5') {
      assert.equal(model.supportsSearch, true);
    } else {
      assert.equal(model.supportsSearch, false, `${model.id} must not advertise Research search`);
    }

    if (model.id === 'moonex-vision-1.5') {
      assert.equal(model.supportsVision, true);
    } else {
      assert.equal(model.supportsVision, false, `${model.id} must not advertise Vision`);
    }
  }

  const auto = STATIC_MOONEX_MODEL_CATALOG.find((model) => model.isAuto);
  assert.ok(auto);
  assert.equal(auto.supportsSearch, true);
  assert.equal(auto.supportsVision, true);
});
