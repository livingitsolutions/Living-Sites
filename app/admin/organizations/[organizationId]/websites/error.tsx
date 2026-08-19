"use client";
import { ErrorMessage, PageHeader } from "../../../components/primitives";
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) { return <><PageHeader eyebrow="Websites" title="Websites" description="Manage the sites owned by this organization." /><ErrorMessage>Websites could not be loaded. <button className="text-button" onClick={reset}>Try again</button></ErrorMessage></>; }
