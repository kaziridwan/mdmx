"use client";
import type { ComponentMap } from "@imdx/editor/react";
import Callout from "../components/imdx/Callout";
import { Stat } from "../components/imdx/Stat";
import TwoColumn from "../components/imdx/TwoColumn";
import Column from "../components/imdx/Column";
import { Hero } from "../components/imdx/Hero";
import { CallToAction } from "../components/imdx/CallToAction";

/** Author components keyed by registry name, for live rendering in the editor. */
export const components: ComponentMap = {
  Callout,
  Stat,
  TwoColumn,
  Column,
  Hero,
  CallToAction,
};
