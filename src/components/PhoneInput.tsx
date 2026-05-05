import * as React from "react";
import { Input } from "@/components/ui/input";
import { formatBRPhone, extractDigits } from "@/lib/phone";

type Props = Omit<React.ComponentProps<typeof Input>, "value" | "onChange" | "type"> & {
  /** Stored value in any format. Component displays the BR-formatted version. */
  value: string | null | undefined;
  /** Called with the cleaned local digits (no country code). Empty string when cleared. */
  onDigitsChange: (digits: string) => void;
};

export const PhoneInput = React.forwardRef<HTMLInputElement, Props>(
  ({ value, onDigitsChange, ...rest }, ref) => {
    const display = formatBRPhone(value);
    return (
      <Input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="(11) 98765-4321"
        value={display}
        onChange={(e) => {
          const digits = extractDigits(e.target.value).slice(0, 11);
          onDigitsChange(digits);
        }}
        {...rest}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";