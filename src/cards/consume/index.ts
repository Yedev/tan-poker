export { Concrete } from './Concrete';
export { DarkDeal } from './DarkDeal';
export { Jackscrew } from './Jackscrew';
export { PrecisionBlast } from './PrecisionBlast';

import { Concrete } from './Concrete';
import { DarkDeal } from './DarkDeal';
import { Jackscrew } from './Jackscrew';
import { PrecisionBlast } from './PrecisionBlast';
import type { ConsumeCardDef } from '../../types/card';

export const AllConsumeCards: ConsumeCardDef[] = [
  Concrete,
  DarkDeal,
  Jackscrew,
  PrecisionBlast,
];
