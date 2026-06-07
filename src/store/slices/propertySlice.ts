import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface PropertyState {
  properties: any[];
  currentProperty: any | null;
  loading: boolean;
  error: string | null;
  filters: {
    query: string;
    location: string;
    property_type: string;
    bhk: string;
  };
}

const initialState: PropertyState = {
  properties: [],
  currentProperty: null,
  loading: false,
  error: null,
  filters: {
    query: "",
    location: "",
    property_type: "",
    bhk: "",
  },
};

const propertySlice = createSlice({
  name: "properties",
  initialState,
  reducers: {
    setProperties(state, action: PayloadAction<any[]>) {
      state.properties = action.payload;
      state.loading = false;
      state.error = null;
    },
    setCurrentProperty(state, action: PayloadAction<any>) {
      state.currentProperty = action.payload;
      state.loading = false;
      state.error = null;
    },
    setFilters(state, action: PayloadAction<Partial<PropertyState["filters"]>>) {
      state.filters = { ...state.filters, ...action.payload };
    },
    resetFilters(state) {
      state.filters = initialState.filters;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      state.loading = false;
    },
  },
});

export const {
  setProperties,
  setCurrentProperty,
  setFilters,
  resetFilters,
  setLoading,
  setError,
} = propertySlice.actions;

export default propertySlice.reducer;
