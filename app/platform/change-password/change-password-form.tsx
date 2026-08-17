"use client";

import { useActionState } from "react";
import { changePlatformPassword, type ChangePasswordState } from "./actions";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";
import { Loader2 } from "lucide-react";

const initialState: ChangePasswordState = {};

export function PlatformChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePlatformPassword, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField id="currentPassword" label="Current password" type="password" required />
      <TextField id="newPassword" label="New password" type="password" required />
      <TextField id="confirmPassword" label="Confirm new password" type="password" required />
      <FormError message={state.error} />
      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Update password
      </SubmitButton>
    </form>
  );
}
