import { z } from 'zod';

/**
 * Example schema to verify React Hook Form + Zod wiring.
 * Replace with real domain schemas when features are implemented.
 */
export const exampleFormSchema = z.object({
  email: z.string().email('Enter a valid email'),
  notes: z.string().max(500).optional(),
});

export type ExampleFormValues = z.infer<typeof exampleFormSchema>;
