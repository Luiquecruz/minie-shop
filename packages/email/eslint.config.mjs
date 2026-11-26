import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { createBaseConfig } from '@minieshop/config/eslint.base.mjs';

export default createBaseConfig({ js, tseslint });
