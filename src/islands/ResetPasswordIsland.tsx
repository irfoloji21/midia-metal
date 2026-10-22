import { useState, useEffect } from 'react';
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

const resetPasswordSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirmation: z.string(),
  })
  .refine((data) => data.password === data.password_confirmation, {
    message: "Passwords don't match",
    path: ['password_confirmation'],
  });

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export default function ResetPasswordIsland() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get('token');
  const email = searchParams.get('email');

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      email: email || '',
      password: '',
      password_confirmation: '',
    },
  });

  useEffect(() => {
    if (!token) {
      toast.error('Invalid password reset link.');
      window.location.href = '/login';
    }
  }, [token]);

  const onSubmit = async (data: ResetPasswordFormValues) => {
    setIsSubmitting(true);
    try {
      await apiFetch('/v1/customer/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          token,
        }),
      });

      toast.success('Password reset successfully! You can now log in.');
      window.location.href = '/login';
    } catch (error: any) {
      if (error.status === 422 && error.data?.email) {
        form.setError('email', { message: error.data.email });
      } else {
        toast.error('Failed to reset password. The link might be expired.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) return null;

  return (
    <>
      <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-slate-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold font-heading text-secondary mb-2">
              Create New Password
            </h1>
            <p className="text-slate-600">
              Please enter your new password below.
            </p>
          </div>

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
                        type="email"
                        readOnly
                        className="bg-slate-50 cursor-not-allowed"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password_confirmation"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm New Password</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
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
                    Resetting...
                  </>
                ) : (
                  'Reset Password'
                )}
              </Button>
            </form>
          </Form>
        </div>
      </div>
    </>
  );
}
