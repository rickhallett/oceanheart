import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { cardAnatomy, nativeSelectAnatomy, tableAnatomy } from "@chakra-ui/react/anatomy";

/** oceanheart's shared visual contract for the public site and practice apps. */
const config = defineConfig({
  preflight: true,
  globalCss: {
    html: { colorPalette: "copper", colorScheme: "light" },
    body: { bg: "bg", color: "fg", fontFamily: "body", fontWeight: "normal", lineHeight: "1.6" },
    "*, *::before, *::after": { boxSizing: "border-box", borderWidth: "0", borderStyle: "solid", borderColor: "border" },
    "button, input, select, textarea": { fontFamily: "body", color: "inherit", margin: "0" },
    button: { background: "transparent", padding: "0" },
    table: { borderCollapse: "collapse", borderSpacing: "0" },
    "button:disabled": { cursor: "not-allowed" },
  },
  theme: {
    tokens: {
      fontSizes: {
        xs: { value: "12px" }, sm: { value: "14px" }, md: { value: "16px" },
        caption: { value: "12px" }, meta: { value: "13px" }, small: { value: "14px" },
        body: { value: "15px" }, reading: { value: "16px" }, label: { value: "16px" },
      },
      fontWeights: { normal: { value: "400" }, medium: { value: "500" }, semibold: { value: "600" } },
      radii: { control: { value: "6px" }, panel: { value: "8px" } },
      borderWidths: { control: { value: "1px" } },
      sizes: { control: { value: "36px" } },
      fonts: {
        body: { value: "var(--font-sans), sans-serif" },
        heading: { value: "var(--font-sans), sans-serif" },
      },
      colors: {
        copper: {
          50: { value: "#fff6ef" }, 100: { value: "#fae6d5" },
          200: { value: "#255bd7" }, 300: { value: "#255bd7" },
          400: { value: "#d48a60" }, 500: { value: "#b96d47" },
          600: { value: "#965336" }, 700: { value: "#74412e" },
          800: { value: "#ceddff" }, 900: { value: "#e1eaff" },
          950: { value: "#eef3ff" },
        },
      },
    },
    semanticTokens: {
      colors: {
        status: {
          neutral: { bg: { value: "#eef1f5" }, fg: { value: "#526174" }, border: { value: "#d8dfe8" } },
          green: { bg: { value: "#e8f5ee" }, fg: { value: "#247548" }, border: { value: "#c6e5d3" } },
          blue: { bg: { value: "#eaf0ff" }, fg: { value: "#3259a6" }, border: { value: "#ccd9f5" } },
          amber: { bg: { value: "#fff4db" }, fg: { value: "#8d6512" }, border: { value: "#f1dfb4" } },
          red: { bg: { value: "#fcecee" }, fg: { value: "#a93d50" }, border: { value: "#efc9d0" } },
        },
        bg: {
          DEFAULT: { value: "#f6f7f9" }, panel: { value: "#ffffff" },
          subtle: { value: "#f0f2f5" }, muted: { value: "#f3f5f7" },
          emphasized: { value: "#e3e8ef" }, inverted: { value: "#17212f" },
        },
        fg: {
          DEFAULT: { value: "#17212f" }, muted: { value: "#596576" },
          subtle: { value: "#718096" }, inverted: { value: "#f6f7f9" },
        },
        border: {
          DEFAULT: { value: "#d5dbe4" }, muted: { value: "#e1e6ed" },
          subtle: { value: "#e9edf2" }, emphasized: { value: "#99a6b8" },
        },
        copper: {
          solid: { value: "{colors.copper.300}" }, contrast: { value: "#ffffff" },
          fg: { value: "{colors.copper.200}" }, subtle: { value: "{colors.copper.950}" },
          muted: { value: "{colors.copper.900}" }, emphasized: { value: "{colors.copper.800}" },
          focusRing: { value: "{colors.copper.300}" },
        },
      },
    },
    recipes: {
      button: {
        base: { borderRadius: "control", minH: "control", fontWeight: "semibold", borderStyle: "solid", whiteSpace: "normal" },
        variants: {
          size: { xs: { fontSize: "sm" }, sm: { fontSize: "sm" }, md: { fontSize: "sm" }, lg: { fontSize: "body" } },
          variant: { outline: { borderWidth: "control", borderColor: "border" }, solid: { borderWidth: "control", borderColor: "transparent" } },
        },
      },
      input: { base: { borderRadius: "control", minH: "control", borderStyle: "solid", fontSize: "reading", fontWeight: "normal" }, variants: { size: { sm: { fontSize: "reading" }, md: { fontSize: "reading" } }, variant: { outline: { borderWidth: "control", borderColor: "border" } } } },
      textarea: { base: { borderRadius: "control", borderStyle: "solid", fontSize: "reading", fontWeight: "normal" }, variants: { variant: { outline: { borderWidth: "control", borderColor: "border" } } } },
    },
    slotRecipes: {
      card: { slots: cardAnatomy.keys(), base: { root: { borderStyle: "solid", borderRadius: "panel", minWidth: "0" } }, variants: { variant: { outline: { root: { borderWidth: "control", borderColor: "border" } } } } },
      nativeSelect: { slots: nativeSelectAnatomy.keys(), base: { field: { h: "control", minH: "control", py: "0", lineHeight: "normal", borderStyle: "solid", borderRadius: "control", fontSize: "reading", fontWeight: "normal" } }, variants: { size: { sm: { field: { fontSize: "reading" } }, md: { field: { fontSize: "reading" } } }, variant: { outline: { field: { borderWidth: "control", borderColor: "border" } } } } },
      table: { slots: tableAnatomy.keys(), base: { cell: { borderStyle: "solid" }, columnHeader: { borderStyle: "solid" } } },
    },
  },
});

export const system = createSystem(defaultConfig, config);
