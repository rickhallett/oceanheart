import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { cardAnatomy, nativeSelectAnatomy, tableAnatomy } from "@chakra-ui/react/anatomy";

/** oceanheart's shared visual contract for the public site and practice apps. */
const config = defineConfig({
  preflight: true,
  globalCss: {
    html: { colorPalette: "copper", colorScheme: "dark" },
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
      fontWeights: { normal: { value: "500" }, medium: { value: "550" }, semibold: { value: "600" } },
      radii: { control: { value: "10px" }, panel: { value: "16px" } },
      borderWidths: { control: { value: "2px" } },
      sizes: { control: { value: "44px" } },
      fonts: {
        body: { value: "var(--font-sans), sans-serif" },
        heading: { value: "var(--font-sans), sans-serif" },
      },
      colors: {
        copper: {
          50: { value: "#fff6ef" }, 100: { value: "#fae6d5" },
          200: { value: "#efc8a9" }, 300: { value: "#e7ad84" },
          400: { value: "#d48a60" }, 500: { value: "#b96d47" },
          600: { value: "#965336" }, 700: { value: "#74412e" },
          800: { value: "#513329" }, 900: { value: "#342720" },
          950: { value: "#211c19" },
        },
      },
    },
    semanticTokens: {
      colors: {
        status: {
          neutral: { bg: { value: "#273741" }, fg: { value: "#d2dde3" }, border: { value: "#485e6b" } },
          green: { bg: { value: "#204a3b" }, fg: { value: "#c0ecd0" }, border: { value: "#3b7659" } },
          blue: { bg: { value: "#203f5a" }, fg: { value: "#c4e3ff" }, border: { value: "#3d6d91" } },
          amber: { bg: { value: "#50401f" }, fg: { value: "#ffe2a0" }, border: { value: "#806535" } },
          red: { bg: { value: "#502c35" }, fg: { value: "#ffd1da" }, border: { value: "#8a4c5a" } },
        },
        bg: {
          DEFAULT: { value: "#081218" }, panel: { value: "#10212b" },
          subtle: { value: "#0c1a23" }, muted: { value: "#172c37" },
          emphasized: { value: "#213c48" }, inverted: { value: "#f3e5d8" },
        },
        fg: {
          DEFAULT: { value: "#f3e5d8" }, muted: { value: "#b9c2c6" },
          subtle: { value: "#95a4ab" }, inverted: { value: "#081218" },
        },
        border: {
          DEFAULT: { value: "#415965" }, muted: { value: "#2c404b" },
          subtle: { value: "#23343e" }, emphasized: { value: "#627e8c" },
        },
        copper: {
          solid: { value: "{colors.copper.300}" }, contrast: { value: "#17130f" },
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
