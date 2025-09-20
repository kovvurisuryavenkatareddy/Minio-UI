import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { showSuccess, showError } from "@/utils/toast";

const formSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
});

interface ForgotPasswordFormProps {
  setView: (view: 'sign_in' | 'sign_up' | 'forgot_password') => void;
}

export const ForgotPasswordForm = ({ setView }: ForgotPasswordFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    setIsSubmitting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      showError(error.message);
    } else {
      showSuccess("Check your email for a password reset link!");
      setView('sign_in');
    }
    setIsSubmitting(false);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100">Forgot Password</h2>
      <p className="text-center text-sm text-muted-foreground mt-2">
        Remembered your password?{' '}
        <Button variant="link" className="p-0 h-auto" onClick={() => setView('sign_in')}>
          Sign in
        </Button>
      </p>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="you@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </form>
      </Form>
    </div>
  );
};