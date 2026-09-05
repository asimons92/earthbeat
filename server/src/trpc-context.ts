import type { User } from './generated/types.js';

export type TrpcContext = {
  user: User | null;
};
