import { createContext, useContext } from 'react';

/** What the job popup tells the panels inside it: is it maximized, and the ad's text. */
export interface PopupLayout {
  wide: boolean;
  adText: string;
}

export const PopupLayoutContext = createContext<PopupLayout>({ wide: false, adText: '' });

export const usePopupLayout = () => useContext(PopupLayoutContext);
