import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

import {
  AuthorizeSecurityGroupIngressCommand,
  CreateKeyPairCommand,
  CreateSecurityGroupCommand,
  EC2Client,
  ImportKeyPairCommand,
  ModifySecurityGroupRulesCommand,
  RunInstancesCommand,
} from '@aws-sdk/client-ec2';

const runEc2Instance = async (props: any) => {};

export function createEc2LaunchAction() {
  return createTemplateAction<{
    name: string;
    ami: string;
    ports: { port: number; protocol: string }[];
    sshKey: string;
  }>({
    id: 'ec2:launch',
    description: 'Runs EC2 instance',
    schema: {
      input: {
        type: 'object',
        required: ['name', 'ami', 'ports'],
        properties: {
          name: {
            title: 'Name of the EC2 instance',
            description: 'The name of the EC2 instance to launch',
            type: 'string',
          },
          ami: {
            title: 'AMI',
            description: 'AMI to use',
            type: 'string',
          },
          ports: {
            type: 'array',
            title: 'Ports',
            description: 'Ports to open',
            items: {
              type: 'object',
              required: ['port', 'protocol'],
              properties: {
                port: {
                  type: 'number',
                  title: 'Port',
                  description: 'Port to open',
                },
                protocol: {
                  type: 'string',
                  title: 'Protocol',
                  description: 'Protocol to use',
                },
              },
            },
          },
        },
      },
    },
    async handler(ctx) {
      const client = new EC2Client({ region: 'us-east-1' });

      const base64EncodedKey = ctx.input.sshKey;
      const decodedKey = Buffer.from(base64EncodedKey, 'base64').toString(
        'utf8',
      );

      const keypair = new ImportKeyPairCommand({
        KeyName: ctx.input.name,
        PublicKeyMaterial: Buffer.from(decodedKey),
      });

      await client.send(keypair);

      const securityGroupCreateCommand = new CreateSecurityGroupCommand({
        Description: 'Security group for EC2 instance',
        GroupName: ctx.input.name,
        TagSpecifications: [
          {
            ResourceType: 'security-group',
            Tags: [
              {
                Key: 'Name',
                Value: ctx.input.name,
              },
            ],
          },
        ],
      });

      const { GroupId } = await client.send(securityGroupCreateCommand);

      ctx.logger.info(`Created security group with ID ${GroupId}`);

      const authorizeSecurityGroupIngressCommand =
        new AuthorizeSecurityGroupIngressCommand({
          GroupId: GroupId,
          IpPermissions: ctx.input.ports.map(port => ({
            IpProtocol: port.protocol,
            FromPort: port.port,
            ToPort: port.port,
            IpRanges: [
              {
                CidrIp: '0.0.0.0/0',
              },
            ],
          })),
        });

      await client.send(authorizeSecurityGroupIngressCommand);

      const runCommand = new RunInstancesCommand({
        ImageId: ctx.input.ami,
        InstanceType: 't2.micro',
        MinCount: 1,
        MaxCount: 1,
        KeyName: ctx.input.name,
        SecurityGroupIds: [GroupId!],
        TagSpecifications: [
          {
            ResourceType: 'instance',
            Tags: [
              {
                Key: 'Name',
                Value: ctx.input.name,
              },
            ],
          },
        ],
      });

      const response = await client.send(runCommand);
      const ip = response.Instances?.[0].PublicIpAddress;
      ctx.logger.info(`Launched EC2 instance with IP ${ip}`);
    },
  });
}
