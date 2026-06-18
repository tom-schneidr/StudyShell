declare module "splitpanes" {
  import { Component, ReactNode } from "react";

  export interface SplitpanesProps {
    className?: string;
    horizontal?: boolean;
    pushOtherPanes?: boolean;
    dblClickSplitter?: boolean;
    rtl?: boolean;
    children?: ReactNode;
  }

  export interface PaneProps {
    size?: number;
    minSize?: number;
    maxSize?: number;
    children?: ReactNode;
  }

  export class Splitpanes extends Component<SplitpanesProps> {}
  export class Pane extends Component<PaneProps> {}
}
