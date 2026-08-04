import {useState} from "react";
import type {FeedContent, OnboardingResult} from "@/types";
import AdminPageApp from "@/components/admin/shared/AdminPageApp";
import WhatsNewApp from "./component/WhatsNewApp";
import DistributionApp from "./component/DistributionApp";
import SetupChecklistApp from "./component/SetupChecklistApp";

interface Props {
  feedContent: FeedContent;
  onboardingResult: OnboardingResult;
}

export default function AdminHomeApp({feedContent, onboardingResult}: Props) {
  const [checklistComplete, setChecklistComplete] = useState(
    onboardingResult.allOk,
  );
  const checklistSection = (
    <div key="setup-checklist">
      <SetupChecklistApp
        feed={feedContent}
        onboardingResult={onboardingResult}
        onCompletionChange={setChecklistComplete}
      />
    </div>
  );
  const publicAccessSection = (
    <div key="public-access">
      <DistributionApp />
    </div>
  );
  const primarySections = checklistComplete
    ? [publicAccessSection, checklistSection]
    : [checklistSection, publicAccessSection];

  return (
    <AdminPageApp>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 xl:col-span-8">
          {primarySections}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:col-span-4">
          <div>
            <WhatsNewApp />
          </div>
        </div>
      </div>
    </AdminPageApp>
  );
}
