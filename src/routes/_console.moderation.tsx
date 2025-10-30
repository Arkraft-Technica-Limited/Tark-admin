import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  CopyIcon,
  PopOutIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";
import {
  Alert,
  Button,
  Form,
  InlineSpinner,
  Link,
  Text,
  Tooltip,
} from "@vector-im/compound-web";
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { defineMessage, FormattedMessage, useIntl } from "react-intl";
import * as v from "valibot";

import {
  adminbotQuery,
  essVersionQuery,
  useEssVariant,
  type AdminbotResponse,
} from "@/api/ess";
import { wellKnownQuery } from "@/api/matrix";
import { ProBadge } from "@/components/logo";
import * as Navigation from "@/components/navigation";
import * as Page from "@/components/page";
import * as Table from "@/components/table";
import * as messages from "@/messages";
import AppFooter from "@/ui/footer";
import { assertNever } from "@/utils/never";

const titleMessage = defineMessage({
  id: "pages.moderation.title",
  defaultMessage: "Moderation",
  description: "The title of the moderation page",
});

export const Route = createFileRoute("/_console/moderation")({
  staticData: {
    breadcrumb: {
      message: titleMessage,
    },
  },

  loader: async ({ context: { queryClient, credentials } }): Promise<void> => {
    const wellKnown = await queryClient.ensureQueryData(
      wellKnownQuery(credentials.serverName),
    );
    const synapseRoot = wellKnown["m.homeserver"].base_url;

    await Promise.all([
      queryClient.ensureQueryData(adminbotQuery(synapseRoot)),
      queryClient.ensureQueryData(essVersionQuery(synapseRoot)),
    ]);
  },

  component: RouteComponent,
});

interface Config {
  instance: URL;
  hostname: string;
  userId: string;
  accessToken: string;
  deviceId: string;
}

const messageSchema = v.picklist(["loaded", "authenticated", "missing-config"]);

type Result = "ok" | "cant open" | "closed";

async function openModeration({
  instance,
  hostname,
  userId,
  accessToken,
  deviceId,
}: Config): Promise<Result> {
  const controller = new AbortController();
  const loginWindow = globalThis.window.open(instance, "moderation-ui");
  if (loginWindow === null || loginWindow.closed) {
    return "cant open";
  }

  let resolve: (result: Result) => void, reject: (reason?: unknown) => void;
  const ready = new Promise<Result>((resolve_, reject_) => {
    resolve = resolve_;
    reject = reject_;
  });

  // Regularly check if the window was closed
  const checkInterval = setInterval(() => {
    if (loginWindow.closed) {
      resolve("closed");
    }
  }, 100);

  // Cleanup the interval on abort
  controller.signal.addEventListener(
    "abort",
    () => clearInterval(checkInterval),
    { signal: controller.signal },
  );

  globalThis.window.addEventListener(
    "message",
    (message: MessageEvent) => {
      if (message.origin !== instance.origin) {
        console.warn("Got message from unexpected origin", message);
        return;
      }

      if (message.source !== loginWindow) {
        console.warn("Got message from unexpected source", message);
        return;
      }

      const result = v.safeParse(messageSchema, message.data);
      if (!result.success) {
        reject(
          new Error("Got message with invalid schema", {
            cause: new v.ValiError(result.issues),
          }),
        );
        return;
      }
      const data = result.output;

      switch (data) {
        case "missing-config": {
          // This is a special case we shouldn't see outside of misconfiguration.
          // No need to localize this error message
          reject(
            new Error("The adminbot UI is reporting a missing configuration"),
          );

          // Close the window
          loginWindow.close();

          break;
        }

        case "loaded": {
          loginWindow.postMessage(
            {
              hostname,
              userId,
              accessToken,
              deviceId,
            },
            instance.origin,
          );
          break;
        }

        case "authenticated": {
          resolve("ok");
          break;
        }

        default: {
          assertNever(data);
        }
      }
    },
    {
      signal: controller.signal,
    },
  );

  try {
    return await ready;
  } finally {
    // This will remove the listener on window
    controller.abort();
  }
}

interface AdminbotContentProps {
  config: AdminbotResponse;
  synapseRoot: string;
}

function AdminbotContent({ config, synapseRoot }: AdminbotContentProps) {
  const intl = useIntl();
  const { mutate, isPending, error, data } = useMutation({
    mutationFn: openModeration,
  });

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>): void => {
      event.preventDefault();

      mutate({
        instance: new URL(config.ui_address),
        hostname: synapseRoot,
        userId: config.mxid,
        accessToken: config.access_token,
        deviceId: config.device_id,
      });
    },
    [mutate, config, synapseRoot],
  );

  return (
    <>
      <Page.Header>
        <Page.Title>
          <FormattedMessage {...titleMessage} />
        </Page.Title>
      </Page.Header>

      <div className="flex flex-col gap-6 max-w-[60ch]">
        <Text size="md">
          <FormattedMessage
            id="pages.moderation.description"
            defaultMessage="Sign in as <b>{mxid}</b> to perform administrative actions in any room."
            description="The description of the moderation page"
            values={{
              mxid: config.mxid,
              b: (chunks) => <b>{...chunks}</b>,
            }}
          />
        </Text>

        {data === "cant open" && (
          <Alert
            type="critical"
            title={intl.formatMessage({
              id: "pages.moderation.errors.cant_open.title",
              defaultMessage:
                "Failed to open the moderation interface in a new window",
              description:
                "The title of the error message when the moderation interface can't be opened",
            })}
          >
            <FormattedMessage
              id="pages.moderation.errors.cant_open.description"
              defaultMessage="Your browser is blocking the opening of pop-up windows. Please make sure you allow pop-ups from this site."
              description="The description of the error message when the moderation interface can't be opened in a new window"
            />
          </Alert>
        )}

        {data === "closed" && (
          <Alert
            type="critical"
            title={intl.formatMessage({
              id: "pages.moderation.errors.closed.title",
              defaultMessage: "The moderation interface was closed too quickly",
              description:
                "The title of the error message when the moderation interface was closed",
            })}
          >
            <FormattedMessage
              id="pages.moderation.errors.closed.description"
              defaultMessage="Failed to sign in the moderation interface, as it closed before it could finish signing in"
              description="The description of the error message when the moderation interface was closed"
            />
          </Alert>
        )}

        {!!error && (
          <Alert
            type="critical"
            title={intl.formatMessage({
              id: "pages.moderation.errors.generic.title",
              defaultMessage:
                "An unexpected error occurred whilst opening the moderation interface",
              description:
                "The title of the error message when the moderation interface can't be opened",
            })}
          >
            {String(error)}
          </Alert>
        )}

        <Button
          className="self-start"
          onClick={onClick}
          disabled={isPending}
          kind="primary"
          size="sm"
          Icon={isPending ? undefined : PopOutIcon}
        >
          {isPending && <InlineSpinner />}
          <FormattedMessage {...messages.actionSignIn} />
        </Button>

        {config.secure_passphrase && (
          <SecurePassphrase
            value={config.secure_passphrase}
            mxid={config.mxid}
          />
        )}
      </div>
    </>
  );
}

interface SecurePassphraseProps {
  value: string;
  mxid: string;
}

function SecurePassphrase({ value, mxid }: SecurePassphraseProps) {
  const intl = useIntl();
  const onCopyClick = useCallback(
    async (event: React.MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
      try {
        await navigator.clipboard.writeText(value);
        toast.success(
          intl.formatMessage({
            id: "pages.moderation.passphrase.copied",
            description:
              "On the moderation page, message displayed when the secure backup passphrase is copied to the clipboard",
            defaultMessage: "Secure backup passphrase copied",
          }),
        );
      } catch (error) {
        console.error("Could not copy passphrase to the clipboard", error);
        toast.error(
          intl.formatMessage({
            id: "pages.moderation.passphrase.copy_failed",
            description:
              "On the moderation page, message displayed when the secure backup passphrase could not be copied to the clipboard",
            defaultMessage: "Could not copy secure backup passphrase",
          }),
        );
      }
    },
    [value, intl],
  );

  return (
    <Form.Root
      onSubmit={(event) => event.preventDefault()}
      className="max-w-[40ch]"
    >
      <Form.Field name="passphrase">
        <Form.Label>
          <FormattedMessage
            id="pages.moderation.passphrase.label"
            description="On the moderation page, label for the secure backup passphrase readonly input field"
            defaultMessage="Secure backup passphrase"
          />
        </Form.Label>
        <div className="flex items-center gap-3">
          <Form.TextControl
            type="password"
            className="flex-1"
            readOnly
            value={value}
          />
          <Tooltip description={intl.formatMessage(messages.actionCopy)}>
            <Button
              iconOnly
              Icon={CopyIcon}
              onClick={onCopyClick}
              kind="secondary"
              size="sm"
            />
          </Tooltip>
        </div>
        <Form.HelpMessage>
          <FormattedMessage
            id="pages.moderation.passphrase.help"
            description="On the moderation page, help text for the secure backup passphrase readonly input field"
            defaultMessage="This is the passphrase used to unlock backups of encrypted messages for the {mxid} account"
            values={{
              mxid,
            }}
          />
        </Form.HelpMessage>
      </Form.Field>
    </Form.Root>
  );
}

interface AdminbotDisabledProps {
  variant: "pro" | "community" | null;
}

function AdminbotDisabled({ variant }: AdminbotDisabledProps) {
  const intl = useIntl();
  const isPro = variant === "pro";
  return (
    <>
      <Page.Header>
        <Page.Title className="flex items-center gap-2">
          <FormattedMessage {...titleMessage} />
          {!isPro && <ProBadge />}
        </Page.Title>

        <Page.Controls>
          {isPro ? (
            <Button
              as="a"
              target="_blank"
              href="https://docs.element.io/latest/element-server-suite-pro/configuring-components/configuring-auditbot/"
              kind="secondary"
              size="sm"
            >
              <FormattedMessage {...messages.actionConfigure} />
            </Button>
          ) : (
            <Button
              as="a"
              target="_blank"
              href="https://try.element.io/upgrade-ess-community"
              kind="primary"
              size="sm"
            >
              <FormattedMessage {...messages.actionUpgrade} />
            </Button>
          )}
        </Page.Controls>
      </Page.Header>

      {isPro && (
        <Alert
          type="info"
          className="max-w-[80ch]"
          title={intl.formatMessage({
            id: "pages.moderation.disabled.pro_alert.title",
            description:
              "When the feature is disabled on an ESS Pro deployment, this is the title of the alert message",
            defaultMessage: "Moderation is currently disabled",
          })}
        >
          <FormattedMessage
            id="pages.moderation.disabled.pro_alert.description"
            description="When the feature is disabled on an ESS Pro deployment, this explains what the feature does"
            defaultMessage="Moderation is part of your ESS Pro subscription, but isn't currently enabled on your deployment."
          />
        </Alert>
      )}

      <Table.Header>
        <Table.Title>
          <FormattedMessage
            id="pages.moderation.disabled.title"
            description="When the feature is disabled, this is the title of the section"
            defaultMessage="Corporate oversight and management of your organization’s conversations."
          />
        </Table.Title>
      </Table.Header>

      <div className="max-w-[80ch] text-balance flex flex-col gap-4 items-start">
        <FormattedMessage
          id="pages.moderation.disabled.description"
          description="When the feature is disabled, this explains what the feature does"
          defaultMessage="<p>Moderating enables an organization to administer all rooms from a central point. It is achieved through the customer using a ‘moderator’ account on their homeserver which is automatically given top level permissions. The moderator capability provides admin rights in every room. The moderator account is visible to all end users to ensure transparency.</p><p>This ‘server-side’ access gives an organization complete oversight, and ensures the organization remains in full control of its deployment.</p>{callToAction}"
          values={{
            callToAction: (
              <Link
                target="_blank"
                href="https://element.io/server-suite/moderating"
              >
                <FormattedMessage {...messages.actionLearnMore} />
              </Link>
            ),
            p: (chunks) => <Text size="md">{...chunks}</Text>,
          }}
        />
      </div>
    </>
  );
}

function RouteComponent() {
  const { credentials } = Route.useRouteContext();
  const { data: wellKnown } = useSuspenseQuery(
    wellKnownQuery(credentials.serverName),
  );
  const synapseRoot = wellKnown["m.homeserver"].base_url;
  const variant = useEssVariant(synapseRoot);
  const { data: adminbot } = useSuspenseQuery(adminbotQuery(synapseRoot));

  return (
    <Navigation.Content>
      <Navigation.Main>
        {adminbot ? (
          <AdminbotContent config={adminbot} synapseRoot={synapseRoot} />
        ) : (
          <AdminbotDisabled variant={variant} />
        )}
      </Navigation.Main>
      <AppFooter />
    </Navigation.Content>
  );
}
