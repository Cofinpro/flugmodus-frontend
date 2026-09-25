// Lässt `node --test` die TypeScript-Quellen laden: Imports ohne Endung ('./crypto') → './crypto.ts'.
// Node streicht die Typen selbst (ab v23.6), daher keine zusätzliche Abhängigkeit.
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context)
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context)
      throw error
    }
  },
})
