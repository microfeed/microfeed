import React from 'react';
import {ArrowRightIcon} from "lucide-react";

import {Button} from "@/components/ui/button";
import {ADMIN_URLS} from "@/shared/StringUtils";
import SettingsBase from '../SettingsBase';
import {SETTINGS_CATEGORIES} from "@/shared/Constants";

function NavBlock({url, text}: {url: string; text: string}) {
  return (
    <Button
      className="h-auto min-h-14 w-full justify-between whitespace-normal px-5 py-4 text-left text-base"
      render={<a href={url} />}
      size="lg"
      variant="outline"
    >
      <span>{text}</span>
      <ArrowRightIcon aria-hidden="true" className="size-5" />
    </Button>
  );
}

export default class CustomCodeSettingsApp extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this.state = {
      currentType: SETTINGS_CATEGORIES.CUSTOM_CODE,
    }
  }

  render() {
    const {submitting, submitForType} = this.props;
    const {currentType} = this.state;
    return (<SettingsBase
      title="Website appearance & code"
      submitting={submitting}
      submitForType={submitForType}
      currentType={currentType}
    >
      <div className="grid gap-6">
        <div>
          <NavBlock
            url={ADMIN_URLS.codeEditorSettings()}
            text="Edit shared HTML code across web pages"
          />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Add code inside <code>&lt;head&gt;</code> and at the top or bottom of <code>&lt;body&gt;</code> across public web pages. Use it for tracking snippets such as Google Analytics and Meta Pixel, or for your own JavaScript and CSS.
          </p>
        </div>

        <div>
          <NavBlock
            url={ADMIN_URLS.themesSettings()}
            text="Manage versioned themes"
          />
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Install, edit, preview, activate, and roll back different versions of themes.
          </p>
        </div>
      </div>
    </SettingsBase>);
  }
}
