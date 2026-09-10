"use client";

import { Button, Checkbox, Input, NativeSelect, Textarea, type ButtonProps, type NativeSelectFieldProps } from "@chakra-ui/react";
import { type ComponentProps } from "react";

type StudioButtonProps = ComponentProps<"button"> & {
  variant?: ButtonProps["variant"];
  loading?: boolean;
};

/** Thin native-event bridge; appearance is selected explicitly, never from class names. */
export function StudioButton({ variant = "ghost", ...props }: StudioButtonProps) {
  return <Button colorPalette="copper" variant={variant} whiteSpace="normal" {...props} />;
}

export function StudioInput({ size: _size, type, ...props }: ComponentProps<"input">) {
  if (type === "checkbox") {
    const { checked, defaultChecked, disabled, required, name, value, ...inputProps } = props;
    return (
      <Checkbox.Root checked={checked} defaultChecked={defaultChecked} disabled={disabled} required={required} name={name} value={value === undefined ? undefined : String(value)} colorPalette="copper">
        <Checkbox.HiddenInput {...inputProps} />
        <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
      </Checkbox.Root>
    );
  }
  return <Input type={type} {...props} />;
}

export function StudioSelect({ size: _size, disabled, ...props }: ComponentProps<"select">) {
  return (
    <NativeSelect.Root disabled={disabled} minW="0">
      <NativeSelect.Field {...({ ...props, disabled } as NativeSelectFieldProps)} />
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
}

export function StudioTextarea(props: ComponentProps<"textarea">) {
  return <Textarea {...props} />;
}
