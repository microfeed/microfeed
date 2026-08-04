import React from 'react';
import {Button} from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default class SettingsBase extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
  }

  render() {
    const {submitForType, submitting, currentType, onSubmit, children, title, titleComponent} = this.props;
    const submittingForThis = submitForType === currentType;
    return (<form className="h-full"><Card className="h-full gap-0 py-0">
      <CardHeader className="gap-3 border-b p-5">
        <CardTitle className="min-w-0 text-lg">
          {title}
          {titleComponent}
        </CardTitle>
        {onSubmit && <CardAction>
          <Button
            disabled={submittingForThis || submitting}
            onClick={onSubmit}
          >{submittingForThis ? 'Updating...' : 'Update'}</Button>
        </CardAction>}
      </CardHeader>
      <CardContent className="p-5">
        {children}
      </CardContent>
    </Card></form>);
  }
}
