import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const forgotPasswordSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address' }),
});

type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPasswordIsland() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: ForgotPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await apiFetch('/v1/customer/forgot-password', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      setIsSubmitted(true);
    } catch (error: any) {
      if (error.status === 422 && error.data?.email) {
        form.setError('email', { message: error.data.email });
      } else {
        toast.error('Failed to send reset link. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-slate-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold font-heading text-secondary mb-2">
              Reset Password
            </h1>
            <p className="text-slate-600">
              Enter your email to receive a password reset link.
            </p>
          </div>

          {isSubmitted ? (
            <div className="text-center space-y-6">
              <div className="bg-primary/10 text-primary p-4 rounded-lg">
                We have emailed your password reset link. Please check your inbox and spam folder.
              </div>
              <Button asChild className="w-full">
                <a href="/login">Return to Login</a>
              </Button>
            </div>
          ) : (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="you@example.com"
                          type="email"
                          autoComplete="email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full text-lg h-12"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Sending Link...
                    </>
                  ) : (
                    'Email Password Reset Link'
                  )}
                </Button>
              </form>
            </Form>
          )}

          <div className="mt-8 text-center">
            <p className="text-slate-600">
              Remembered your password?{' '}
              <a
                href="/login"
                className="text-primary font-medium hover:underline transition-colors"
              >
                Sign In
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
