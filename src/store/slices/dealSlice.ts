import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";

interface DealState {
  deals: any[];
  activeDeal: any | null;
  loading: boolean;
  error: string | null;
}

const initialState: DealState = {
  deals: [],
  activeDeal: null,
  loading: false,
  error: null,
};

const dealSlice = createSlice({
  name: "deals",
  initialState,
  reducers: {
    setDeals(state, action: PayloadAction<any[]>) {
      state.deals = action.payload;
      state.loading = false;
      state.error = null;
    },
    setActiveDeal(state, action: PayloadAction<any>) {
      state.activeDeal = action.payload;
      state.loading = false;
      state.error = null;
    },
    addNegotiationMessage(state, action: PayloadAction<any>) {
      if (state.activeDeal && state.activeDeal.id === action.payload.dealId) {
        state.activeDeal.negotiation_history.push(action.payload.message);
      }
      // Also update in the list of deals if matching
      const dealIdx = state.deals.findIndex((d) => d.id === action.payload.dealId);
      if (dealIdx !== -1) {
        state.deals[dealIdx].negotiation_history.push(action.payload.message);
        state.deals[dealIdx].status = action.payload.status || state.deals[dealIdx].status;
      }
    },
    updateDealStatus(state, action: PayloadAction<{ dealId: string; status: string; agreedPrice?: number }>) {
      if (state.activeDeal && state.activeDeal.id === action.payload.dealId) {
        state.activeDeal.status = action.payload.status;
        if (action.payload.agreedPrice !== undefined) {
          state.activeDeal.agreed_price = action.payload.agreedPrice;
        }
      }
      const dealIdx = state.deals.findIndex((d) => d.id === action.payload.dealId);
      if (dealIdx !== -1) {
        state.deals[dealIdx].status = action.payload.status;
        if (action.payload.agreedPrice !== undefined) {
          state.deals[dealIdx].agreed_price = action.payload.agreedPrice;
        }
      }
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
  setDeals,
  setActiveDeal,
  addNegotiationMessage,
  updateDealStatus,
  setLoading,
  setError,
} = dealSlice.actions;

export default dealSlice.reducer;
