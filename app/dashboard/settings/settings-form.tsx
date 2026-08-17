"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { saveSettings, type SettingsState } from "./actions";
import { TextField, FormError, SubmitButton } from "@/components/dashboard/form-field";

const initialState: SettingsState = {};

export function SettingsForm({ attendanceMinPercent }: { attendanceMinPercent: string }) {
  const [state, formAction, pending] = useActionState(saveSettings, initialState);

  useEffect(() => {
    if (state.success) toast.success("Settings saved");
  }, [state.success]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <TextField
        id="attendanceMinPercent"
        label="Minimum attendance %"
        type="number"
        defaultValue={attendanceMinPercent}
        required
      />

      <FormError message={state.error} />

      <SubmitButton pending={pending}>
        {pending && <Loader2 className="h-4 w-4 animate-spin" />}
        Save settings
      </SubmitButton>
    </form>
  );
}
